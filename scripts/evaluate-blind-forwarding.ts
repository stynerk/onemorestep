import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, closeSync, existsSync, openSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { createAssessmentService } from "../src/lib/forwarding/assessment-service";
import { requestDomainEvidence } from "../src/lib/forwarding/domain-router";
import { requestInquiryIntent } from "../src/lib/forwarding/intent-router";
import { routingReplayRow } from "./routing-replay";
import type { LeadInput } from "../src/lib/forwarding/types";

const engine = "e0c919ffae62a981b494de90d4891a36c2e30ec5";
const directory = ".cache/eval2";
const recordingPath = directory + "/recordings.jsonl";
const manifestPath = directory + "/manifest.json";
const kinds = ["search", "intent", "domain"] as const;
type Kind = (typeof kinds)[number];
type Mode = "capture" | "replay" | "routing";
type Reply =
  | { status: number; body: string | null; retryAfter: string | null }
  | { error: "timeout" | "transport" };
type Start = { phase: "start"; id: string; leadId: string; kind: Kind; attempt: number };
type Finish = { phase: "finish"; id: string; reply: Reply };
type Saved = Start & { reply?: Reply };

const searchUrl = "https://platform.liner.com/api/v1/tools/search/web";
const routerUrl = "https://platform.liner.com/api/v1/chat/completions";
const digest = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);

function parseInputs(value: unknown): LeadInput[] {
  const fields = ["id", "institution", "email", "country", "product", "memo", "name", "phone", "receivedAt"] as const;
  if (!Array.isArray(value) || value.length !== 30 || !value.every((lead, index) => object(lead)
    && Object.keys(lead).length === fields.length && fields.every((field) => typeof lead[field] === "string")
    && lead.id === "N" + String(index + 1).padStart(2, "0") && lead.name === "" && lead.phone === ""
    && typeof lead.receivedAt === "string" && Number.isFinite(Date.parse(lead.receivedAt)))) {
    throw new Error("Expected 30 ordered, operational-only N01–N30 inputs.");
  }
  return value as LeadInput[];
}

function readRecordings(header: string, mode: Mode) {
  if (!existsSync(recordingPath)) {
    if (mode !== "capture") throw new Error("Capture recordings are missing.");
    writeFileSync(recordingPath, header + "\n", { flag: "wx" });
  }
  const [first, ...lines] = readFileSync(recordingPath, "utf8").trimEnd().split("\n");
  if (first !== header) throw new Error("Recording input or engine fingerprint does not match.");
  const recordings = new Map<string, Saved>();
  for (const line of lines) {
    const event = JSON.parse(line) as Start | Finish;
    const existing = recordings.get(event.id);
    if (event.phase === "start" && !existing) {
      recordings.set(event.id, event);
    } else if (event.phase === "finish" && existing && !existing.reply) {
      recordings.set(event.id, { ...existing, reply: event.reply });
    } else {
      throw new Error("Recording sequence is invalid.");
    }
  }
  if ([...recordings.values()].some((item) => !item.reply)) {
    throw new Error("A previous request did not finish recording. Automatic refetch is disabled.");
  }
  return recordings;
}

function captureKey() {
  let key = process.env.LINER_API_KEY?.trim();
  if (!key && existsSync("../../.env.local")) {
    key = parseEnv(readFileSync("../../.env.local", "utf8")).LINER_API_KEY?.trim();
  }
  if (!key) throw new Error("Missing configured Liner credentials for capture.");
  return key;
}

function readReply(reply: Reply): Response {
  if ("error" in reply) throw new Error("Recorded " + reply.error);
  return new Response(reply.status === 204 || reply.status === 205 || reply.status === 304 ? null : reply.body, {
    status: reply.status,
    headers: reply.retryAfter ? { "Retry-After": reply.retryAfter } : undefined,
  });
}

async function measure(mode: Mode) {
  const leads = parseInputs(JSON.parse(readFileSync(directory + "/inputs.json", "utf8")));
  const inputSha256 = digest(JSON.stringify(leads));
  const header = JSON.stringify({ version: 1, engine, inputSha256 });
  const recordings = readRecordings(header, mode);
  const apiKey = mode === "capture" ? captureKey() : "offline-replay";
  if (mode !== "capture") {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    if (manifest.engine !== engine || manifest.inputSha256 !== inputSha256
      || manifest.recordingsSha256 !== digest(readFileSync(recordingPath, "utf8"))) {
      throw new Error("Capture manifest does not match the input and exchange log.");
    }
  }
  const used = new Set<string>();
  const attempts = new Map<string, number>();
  const counts = Object.fromEntries(kinds.map((kind) => [kind, {
    upstream: 0, replayed: 0, retries: 0, statuses: {} as Record<string, number>,
  }])) as Record<Kind, { upstream: number; replayed: number; retries: number; statuses: Record<string, number> }>;
  let activeLead = "";
  let blocked: string | undefined;

  function append(event: Start | Finish) {
    try {
      appendFileSync(recordingPath, JSON.stringify(event) + "\n", "utf8");
    } catch {
      blocked = "Upstream exchange could not be recorded.";
      throw new Error(blocked);
    }
  }

  function fetchFor(kind: Kind): typeof fetch {
    return async (input, init) => {
      if (blocked) throw new Error(blocked);
      const endpoint = kind === "search" ? searchUrl : routerUrl;
      if (input !== endpoint || init?.method !== "POST" || typeof init.body !== "string") {
        blocked = "Unexpected upstream request.";
        throw new Error(blocked);
      }
      const fingerprint = digest(JSON.stringify([header, activeLead, kind, endpoint, init.body]));
      const attempt = (attempts.get(fingerprint) ?? 0) + 1;
      attempts.set(fingerprint, attempt);
      const id = fingerprint + ":" + attempt;
      const saved = recordings.get(id);
      let reply: Reply;
      if (saved?.reply) {
        if (saved.leadId !== activeLead || saved.kind !== kind || saved.attempt !== attempt) {
          blocked = "Recorded request metadata does not match.";
          throw new Error(blocked);
        }
        counts[kind].replayed++;
        reply = saved.reply;
      } else if (mode !== "capture") {
        blocked = "No recording matches an exact request fingerprint.";
        throw new Error(blocked);
      } else {
        const start = { phase: "start", id, leadId: activeLead, kind, attempt } as const;
        append(start);
        counts[kind].upstream++;
        try {
          const response = await fetch(endpoint, init);
          const body = response.ok ? await response.text() : null;
          if (body?.includes(apiKey)) {
            blocked = "The upstream echoed a credential. Its response was discarded.";
            throw new Error(blocked);
          }
          reply = { status: response.status, body, retryAfter: response.headers.get("Retry-After") };
        } catch {
          reply = { error: init.signal?.aborted ? "timeout" : "transport" };
        }
        append({ phase: "finish", id, reply });
        recordings.set(id, { ...start, reply });
      }
      used.add(id);
      if (attempt > 1) counts[kind].retries++;
      const status = "status" in reply ? String(reply.status) : reply.error;
      counts[kind].statuses[status] = (counts[kind].statuses[status] ?? 0) + 1;
      if ("status" in reply && [401, 402, 403].includes(reply.status)) blocked = "Liner authorization or credits prevented capture.";
      return readReply(reply);
    };
  }

  const service = createAssessmentService({ fetcher: fetchFor("search") });
  const intentFetcher = fetchFor("intent");
  const domainFetcher = fetchFor("domain");
  const predictions = [];
  const routing: ReturnType<typeof routingReplayRow>[] = [];
  for (const lead of leads) {
    activeLead = lead.id;
    const options = { apiKey };
    const intent = lead.institution.trim() ? requestInquiryIntent(lead.memo, { ...options, fetcher: intentFetcher }) : null;
    let domainAdvice = null as Awaited<ReturnType<typeof requestDomainEvidence>>;
    const result = await service.assess(lead, {
      ...options, mode: "live", regionalCountry: lead.country, intent,
      domainAdvice: async (input) => {
        domainAdvice = await requestDomainEvidence(input, { ...options, fetcher: domainFetcher });
        return domainAdvice;
      },
    });
    if (blocked) throw new Error(blocked);
    const { verdict, reason, handoff, sources, mode: evidenceMode, details } = result.assessment;
    const route = mode === "routing" ? routingReplayRow(lead, result.assessment) : undefined;
    if (route) routing.push(route);
    predictions.push({ id: lead.id, verdict, reason, handoff: route ? route.before : handoff, sources, mode: evidenceMode, details,
      intentAdvice: await intent, domainAdvice });
    if (mode === "capture") console.log(lead.id + " recorded");
  }
  if (used.size !== recordings.size) throw new Error("Capture includes requests the frozen engine did not consume.");
  const predictionsSha256 = digest(JSON.stringify(predictions));
  const manifest = { engine, inputSha256, predictionsSha256, exchanges: used.size,
    recordingsSha256: digest(readFileSync(recordingPath, "utf8")) };
  if (mode === "capture") {
    if (existsSync(manifestPath) && JSON.stringify(JSON.parse(readFileSync(manifestPath, "utf8"))) !== JSON.stringify(manifest)) {
      throw new Error("Existing capture manifest would change.");
    }
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  } else if (JSON.stringify(JSON.parse(readFileSync(manifestPath, "utf8"))) !== JSON.stringify(manifest)) {
    throw new Error("Replay differs from capture.");
  }
  const outputMode = mode === "routing" ? "replay" : mode;
  writeFileSync(directory + "/" + outputMode + ".json", JSON.stringify({ ...manifest, counts, predictions }, null, 2) + "\n");
  if (mode === "routing") writeFileSync(directory + "/routing.json", JSON.stringify(routing) + "\n");
  console.log(JSON.stringify({ ...manifest, mode, counts }));
}

async function main() {
  const mode = process.argv[2];
  if ((mode !== "capture" && mode !== "replay" && mode !== "routing") || process.argv.length !== 3) {
    throw new Error("Usage: node --import tsx scripts/evaluate-blind-forwarding.ts capture|replay|routing");
  }
  const engineFiles = [
    "src/lib/liner-search.ts",
    ...["assessment-service", "dealers", "domain-router", "handoff", "inbox", "institution-policy", "intent-router",
      "policy", "saved-institution-sources", "seed", "types", "verdict"].map((name) => "src/lib/forwarding/" + name + ".ts"),
    "src/lib/forwarding/seed-leads.json",
  ];
  try {
    if (mode !== "routing") execFileSync("git", ["diff", "--quiet", engine, "--", ...engineFiles], { stdio: "ignore" });
  } catch {
    throw new Error("The checked-out assessment engine does not match " + engine + ".");
  }
  if (mode !== "capture") {
    await measure(mode);
    return;
  }
  const lockPath = directory + "/capture.lock";
  const lock = openSync(lockPath, "wx");
  try {
    await measure(mode);
  } finally {
    closeSync(lock);
    unlinkSync(lockPath);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Blind measurement failed.");
  process.exitCode = 1;
});
