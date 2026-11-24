import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { gunzipSync, gzipSync } from "node:zlib";
import { createAssessmentService } from "../src/lib/forwarding/assessment-service";
import { requestDomainEvidence } from "../src/lib/forwarding/domain-router";
import { requestInquiryIntent } from "../src/lib/forwarding/intent-router";
import type { LeadInput } from "../src/lib/forwarding/types";

const engine = "ca0cf6e299772744aa5e734fab99dbe96cbed7be";
const searchUrl = "https://platform.liner.com/api/v1/tools/search/web";
const modelUrl = "https://platform.liner.com/api/v1/chat/completions";
const model = "liner-gpt-router";
const sourcePath = "docs/qa/LARGE_EVAL_1000.csv";
const cacheDirectory = ".cache/large-eval-x";
const expectedInput = "bdee3a36fae354cdcbe478c837f4ff1bfc6bcc324f5e7bd75a2ba1133813b70e";
const csvHeader = "ID,소속,이메일,리드 국가,상품,메모,HJ 정답 (유효/애매/국가 확인/제휴 확인/무효),넘길 곳 ,이유·메모 (선택)";
const digest = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const kinds = ["search", "intent", "domain"] as const;
type Kind = (typeof kinds)[number];
type Reply = { status: number; body: string | null; retryAfter: string | null } | { error: "timeout" | "transport" };
type RequestStart = { event: "start"; id: string; key: string; kind: Kind; at: string };
type RequestFinish = { event: "finish"; id: string; reply: Reply };
type Observation = { event: "cache"; id: string; key: string; source: string };
type Exchange = RequestStart & { reply: Reply };
type RecordEvent = RequestStart | RequestFinish | Observation;

function parseCsv(contents: string): LeadInput[] {
  const rows: string[][] = [];
  if (contents.charCodeAt(0) !== 0xfeff) throw new Error("Expected the blank sheet UTF-8 BOM.");
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 1; index < contents.length; index++) {
    const char = contents[index];
    if (char === '"') {
      if (quoted && contents[index + 1] === '"') {
        field += '"';
        index++;
      } else quoted = !quoted;
    } else if (!quoted && (char === "," || char === "\n")) {
      row.push(field);
      field = "";
      if (char === "\n") {
        rows.push(row);
        row = [];
      }
    } else if (quoted || char !== "\r") field += char;
  }
  if (quoted) throw new Error("Unterminated CSV quotation.");
  if (field || row.length) rows.push([...row, field]);
  if (rows.shift()?.join(",") !== csvHeader || rows.length !== 1000) {
    throw new Error("Expected the 1,000-row blank labeling sheet.");
  }
  const receivedAt = "2026-11-25T00:00:00.000Z";
  return rows.map(([id, institution, email, country, product, memo, ...answerFields], index) => {
    const sequence = String(index + 1).padStart(4, "0");
    if (id !== "X" + sequence || !email || !country || !product || !memo
      || !email.startsWith("mrn-lg-" + sequence + "@") || !/^mrn-lg-\d{4}@[^@\s]+$/.test(email)
      || answerFields.length !== 3 || answerFields.some((value) => value !== "")) {
      throw new Error("Unexpected synthetic lead at CSV row " + (index + 2));
    }
    return { id, institution, email, country, product, memo, name: "", phone: "", receivedAt };
  });
}

function credentials() {
  const envPath = "../../.env.local";
  const apiKey = process.env.LINER_API_KEY?.trim()
    || (existsSync(envPath) ? parseEnv(readFileSync(envPath, "utf8")).LINER_API_KEY?.trim() : undefined);
  if (!apiKey) throw new Error("Liner is not configured for capture.");
  return apiKey;
}

function requestGate(maximum: number) {
  const queue: (() => void)[] = [];
  let active = 0;
  return async <T>(task: () => Promise<T>): Promise<T> => {
    if (active >= maximum) await new Promise<void>((resolve) => queue.push(resolve));
    else active++;
    try {
      return await task();
    } finally {
      const next = queue.shift();
      if (next) next();
      else active--;
    }
  };
}

function asResponse(reply: Reply) {
  if ("error" in reply) throw new Error("Recorded " + reply.error);
  return new Response(reply.body, {
    status: reply.status,
    headers: reply.retryAfter ? { "Retry-After": reply.retryAfter } : undefined,
  });
}

function readInputs() {
  const input = readFileSync(sourcePath);
  const inputSha256 = digest(input);
  if (inputSha256 !== expectedInput) throw new Error("The blank labeling sheet differs from the frozen input.");
  return { leads: parseCsv(input.toString("utf8")), inputSha256 };
}

async function measure(mode: "capture" | "replay") {
  const { leads, inputSha256 } = readInputs();
  const journalPath = cacheDirectory + "/liner.jsonl";
  const bundlePath = cacheDirectory + "/liner-recordings.jsonl.gz";
  const resultPath = cacheDirectory + "/liner-predictions.json";
  const header = JSON.stringify({ version: 1, engine, inputSha256, model });
  if (mode === "capture" && !existsSync(journalPath)) {
    if (existsSync(bundlePath)) throw new Error("A completed capture already exists. Use replay.");
    writeFileSync(journalPath, header + "\n", { flag: "wx" });
  }
  const capture = mode === "capture";
  const apiKey = capture ? credentials() : "offline-replay";
  const [savedHeader, ...lines] = (capture ? readFileSync(journalPath, "utf8")
    : gunzipSync(readFileSync(bundlePath)).toString("utf8")).trimEnd().split("\n");
  if (savedHeader !== header) throw new Error("Capture differs from the current input or engine fingerprint.");
  const started = new Map<string, RequestStart>();
  const exchanges = new Map<string, Exchange>();
  const observations = new Map<string, Observation>();
  const searchCache = new Map<string, Exchange>();
  const inFlight = new Map<string, Promise<Exchange>>();
  const used = new Set<string>();
  const critical = { error: "" };
  const gate = { search: requestGate(8), model: requestGate(10) };
  const ok = (reply: Reply) => "status" in reply && reply.status === 200;
  const isAuthorizationFailure = (reply: Reply) => "status" in reply && [401, 402, 403].includes(reply.status);

  for (const line of lines) {
    const record = JSON.parse(line) as RecordEvent;
    if (record.event === "start" && !started.has(record.id)) {
      started.set(record.id, record);
    } else if (record.event === "finish" && started.has(record.id) && !exchanges.has(record.id)) {
      const exchange = { ...started.get(record.id)!, reply: record.reply };
      if (isAuthorizationFailure(exchange.reply)) throw new Error("Prior capture was blocked by Liner authorization or credits.");
      exchanges.set(record.id, exchange);
      if (exchange.kind === "search" && ok(exchange.reply)) searchCache.set(exchange.key, exchange);
    } else if (record.event === "cache" && !observations.has(record.id)) {
      observations.set(record.id, record);
    } else throw new Error("Invalid exchange journal.");
  }
  if (started.size !== exchanges.size) throw new Error("An interrupted upstream attempt lacks a response. Automatic refetch is disabled.");

  function append(record: RecordEvent) {
    try {
      appendFileSync(journalPath, JSON.stringify(record) + "\n", "utf8");
    } catch {
      critical.error = "Could not record the upstream exchange.";
      throw new Error(critical.error);
    }
  }

  async function upstream(id: string, key: string, kind: Kind, input: string, init: RequestInit): Promise<Exchange> {
    const invoke = kind === "search" ? gate.search : gate.model;
    return invoke(async () => {
      if (critical.error) throw new Error(critical.error);
      const start = { event: "start", id, key, kind, at: new Date().toISOString() } as const;
      append(start);
      let reply: Reply;
      try {
        const response = await fetch(input, { ...init, redirect: "error" });
        const body = response.ok ? await response.text() : null;
        if (body?.includes(apiKey)) {
          critical.error = "Upstream response containing a credential was discarded.";
          throw new Error(critical.error);
        }
        reply = {
          status: response.status,
          body,
          retryAfter: response.headers.get("Retry-After"),
        };
      } catch {
        reply = { error: init.signal?.aborted ? "timeout" : "transport" };
      }
      append({ event: "finish", id, reply });
      if (isAuthorizationFailure(reply)) critical.error = "Liner authorization or credits prevented capture.";
      const exchange = { ...start, reply };
      exchanges.set(id, exchange);
      if (kind === "search" && ok(reply)) searchCache.set(key, exchange);
      return exchange;
    });
  }

  async function assess(lead: LeadInput) {
    const attempts = new Map<string, number>();
    const failures: { kind: Kind; status: string }[] = [];
    const fetchFor = (kind: Kind): typeof fetch => async (input, init) => {
      if (critical.error) throw new Error(critical.error);
      const endpoint = kind === "search" ? searchUrl : modelUrl;
      if (input !== endpoint || init?.method !== "POST" || typeof init.body !== "string") {
        critical.error = "Unexpected frozen-engine request.";
        throw new Error(critical.error);
      }
      const key = digest(JSON.stringify([lead.country, endpoint, init.body]));
      const ordinal = (attempts.get(key) ?? 0) + 1;
      attempts.set(key, ordinal);
      const id = lead.id + ":" + kind + ":" + key + ":" + ordinal;
      let exchange = exchanges.get(id);
      const observation = observations.get(id);
      if (observation) {
        exchange = exchanges.get(observation.source);
        if (observation.key !== key || !exchange || !ok(exchange.reply)) {
          critical.error = "A saved search observation cannot be replayed.";
          throw new Error(critical.error);
        }
      }
      if (!exchange && !capture) {
        critical.error = "A frozen-engine request has no exact recording.";
        throw new Error(critical.error);
      }
      if (!exchange && kind === "search") {
        exchange = searchCache.get(key);
        const pending = inFlight.get(key);
        if (!exchange && pending) exchange = await pending;
        if (exchange && ok(exchange.reply)) {
          const hit = { event: "cache", id, key, source: exchange.id } as const;
          append(hit);
          observations.set(id, hit);
        } else {
          const operation = upstream(id, key, kind, endpoint, init);
          inFlight.set(key, operation);
          try {
            exchange = await operation;
          } finally {
            if (inFlight.get(key) === operation) inFlight.delete(key);
          }
        }
      }
      exchange ??= await upstream(id, key, kind, endpoint, init);
      if (exchange.key !== key || exchange.kind !== kind) {
        critical.error = "Recording metadata differs from the frozen request.";
        throw new Error(critical.error);
      }
      used.add(id);
      const { reply } = exchange;
      if (!ok(reply)) failures.push({ kind, status: "status" in reply ? String(reply.status) : reply.error });
      return asResponse(reply);
    };
    const service = createAssessmentService({ fetcher: fetchFor("search") });
    const intent = lead.institution.trim() ? requestInquiryIntent(lead.memo, { apiKey, fetcher: fetchFor("intent") }) : null;
    const { assessment } = await service.assess(lead, {
      apiKey, mode: "live", regionalCountry: lead.country, intent,
      domainAdvice: (input) => requestDomainEvidence(input, { apiKey, fetcher: fetchFor("domain") }),
    });
    if (critical.error) throw new Error(critical.error);
    const { verdict, reason, handoff, mode: evidenceMode } = assessment;
    return { id: lead.id, verdict, reason, handoff, mode: evidenceMode, failures };
  }

  const predictions = new Array<Awaited<ReturnType<typeof assess>>>(leads.length);
  let next = 0;
  let done = 0;
  const workers = Array.from({ length: capture ? 8 : 4 }, async () => {
    while (next < leads.length && !critical.error) {
      const index = next++;
      predictions[index] = await assess(leads[index]);
      if (++done % 50 === 0) console.log(mode + " " + done + "/" + leads.length);
    }
  });
  const results = await Promise.allSettled(workers);
  if (results.some(({ status }) => status === "rejected") || done !== leads.length) {
    throw new Error(critical.error || "Liner measurement did not finish.");
  }
  if (used.size !== exchanges.size + observations.size) throw new Error("Some recorded requests were not consumed.");
  const counts = Object.fromEntries(kinds.map((kind) => {
    const requests = [...exchanges.values()].filter((value) => value.kind === kind);
    const statuses: Record<string, number> = {};
    for (const { reply } of requests) {
      const status = "status" in reply ? String(reply.status) : reply.error;
      statuses[status] = (statuses[status] ?? 0) + 1;
    }
    return [kind, { upstream: requests.length, statuses }];
  }));
  const exchangeTimes = [...exchanges.values()].map(({ at }) => at).sort();
  const manifest = {
    engine, inputSha256, model, captureStartedAt: exchangeTimes[0], captureLastRequestAt: exchangeTimes.at(-1),
    counts, searchCacheHits: observations.size, predictionsSha256: digest(JSON.stringify(predictions)),
    leadsWithUpstreamErrors: predictions.filter(({ failures }) => failures.length > 0).length,
  };
  if (capture) {
    const compressed = gzipSync(readFileSync(journalPath));
    writeFileSync(bundlePath, compressed, { flag: "wx" });
    writeFileSync(resultPath, JSON.stringify({ ...manifest, recordingsSha256: digest(compressed), predictions }, null, 2) + "\n");
  } else {
    const saved = JSON.parse(readFileSync(resultPath, "utf8"));
    if (saved.engine !== engine || saved.inputSha256 !== inputSha256 || saved.model !== model
      || saved.predictionsSha256 !== manifest.predictionsSha256
      || saved.predictionsSha256 !== digest(JSON.stringify(saved.predictions))
      || saved.recordingsSha256 !== digest(readFileSync(bundlePath))) {
      throw new Error("Offline replay differs from recorded output.");
    }
  }
  console.log(JSON.stringify({ mode, ...manifest }));
}

async function main() {
  const mode = process.argv[2];
  if ((mode !== "capture" && mode !== "replay" && mode !== "validate") || process.argv.length !== 3) {
    throw new Error("Usage: node --import tsx scripts/evaluate-large-liner.ts validate|capture|replay");
  }
  execFileSync("git", ["diff", "--quiet", engine, "--", "src/lib", "src/app/api/forwarding/assess"], { stdio: "ignore" });
  if (mode === "validate") {
    const { leads, inputSha256 } = readInputs();
    console.log(JSON.stringify({ mode, engine, inputSha256, total: leads.length, firstId: leads[0].id, lastId: leads.at(-1)?.id }));
    return;
  }
  if (mode === "replay") {
    await measure(mode);
    return;
  }
  mkdirSync(cacheDirectory, { recursive: true });
  const lockPath = cacheDirectory + "/liner.lock";
  const lock = openSync(lockPath, "wx");
  try {
    await measure(mode);
  } finally {
    closeSync(lock);
    unlinkSync(lockPath);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Liner evaluation failed.");
  process.exitCode = 1;
});
