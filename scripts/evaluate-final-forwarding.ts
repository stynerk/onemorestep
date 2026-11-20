import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createAssessmentService } from "../src/lib/forwarding/assessment-service";
import demoAnswers from "../src/lib/forwarding/evaluation/ground-truth.json";
import { forwardingPolicy } from "../src/lib/forwarding/policy";
import { createInitialForwardingState } from "../src/lib/forwarding/seed";
import { VERDICTS, type Assessment, type LeadInput, type Product, type Verdict } from "../src/lib/forwarding/types";

type Handoff = NonNullable<Assessment["handoff"]>["kind"];
type Expected = { verdict: Verdict; handoff: Handoff };
const verdictNames = new Map<string, Verdict>([
  ["유효", "valid"], ["애매", "ambiguous"], ["국가 확인", "country-check"],
  ["제휴 확인", "partnership-check"], ["무효", "invalid"],
]);
const handoffExclusions = new Set(["E09", "E59", "E67"]);
const endpoint = "https://platform.liner.com/api/v1/tools/search/web";
const apiVersion = "v1";
const handoffs: readonly Handoff[] = ["dealer", "regional-sales", "hr", "none"];
const digest = (value: string) => createHash("sha256").update(value).digest("hex");

function heldOutInputs(markdown: string): LeadInput[] {
  const leads = markdown.split(/\r?\n/u).filter((line) => /^\| E\d\d \|/u.test(line)).map((line) => {
    const [, id, institution, email, country, product, memo, expected, handoff, trailing] =
      line.split("|").map((field) => field.trim());
    if (!id || !email || !country || !Object.hasOwn(forwardingPolicy.customerIndustries, product)
      || expected !== "" || handoff !== "" || trailing !== "") throw new Error("Invalid held-out input table.");
    return {
      id, institution: institution === "(빈칸)" ? "" : institution, email, country,
      product: product as Product, memo, name: "", phone: "", receivedAt: forwardingPolicy.referenceDate,
    };
  });
  if (leads.length !== 70 || new Set(leads.map(({ id }) => id)).size !== 70) {
    throw new Error("Expected 70 unique held-out inputs.");
  }
  return leads;
}

function csvRows(csv: string) {
  // Allow embedded commas, doubled quotes and newlines in HJ's notes.
  const records = csv.trimEnd().match(/(?:[^"\r\n]|"(?:[^"]|"")*")+/gu) ?? [];
  return records.map((record) => [...record.matchAll(/(?:^|,)(?:"((?:[^"]|"")*)"|([^",\r\n]*))/gu)]
    .map((match) => (match[1]?.replaceAll('""', '"') ?? match[2]).trim()));
}

function heldOutAnswers(csv: string, leads: LeadInput[]) {
  const inputs = new Map(leads.map((lead) => [lead.id, lead]));
  const answers = new Map<string, Expected>();
  for (const row of csvRows(csv).slice(1)) {
    const [id, institution, email, country, product, memo, verdictName, route] = row;
    const lead = inputs.get(id);
    const verdict = verdictNames.get(verdictName);
    const handoff = route === "" ? "none" : route === "인사팀" ? "hr"
      : /^(?:APAC|EU|LATAM|MEA|NA) 세일즈팀$/u.test(route) ? "regional-sales"
      : route === country + " 딜러" ? "dealer" : undefined;
    if (!lead || !verdict || !handoff || row.length !== 9 || answers.has(id)
      || lead.institution !== (institution === "(빈칸)" ? "" : institution)
      || lead.email !== email || lead.country !== country || lead.product !== product || lead.memo !== memo) {
      throw new Error("HJ answer row does not match a unique operational input: " + id);
    }
    answers.set(id, { verdict, handoff });
  }
  if (answers.size !== leads.length) throw new Error("Missing HJ answer rows.");
  return answers;
}

type Recording = {
  fingerprint: string;
  inputHash: string;
  apiVersion: string;
  recordedAt: string;
  status: number;
  retryAfter: string | null;
  body: string;
};

function searchTransport(mode: string, inputHash: string) {
  const directory = ".cache/final-forwarding-recordings";
  const counts = { fetched: 0, replayed: 0, blocked: 0, networkErrors: 0, statuses: {} as Record<number, number> };
  const fetcher: typeof fetch = async (input, options) => {
    if (mode === "sample" || input !== endpoint || options?.method !== "POST" || typeof options.body !== "string") {
      counts.blocked += 1;
      throw new Error("Evaluation only allows Liner Search API v1.");
    }
    const fingerprint = digest(JSON.stringify([inputHash, apiVersion, input, options.body]));
    const path = join(directory, fingerprint + ".json");
    let record: Recording;
    const existing = await readFile(path, "utf8").catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    if (existing !== null) {
      record = JSON.parse(existing) as Recording;
      if (record.fingerprint !== fingerprint || record.apiVersion !== apiVersion || record.inputHash !== inputHash) {
        counts.blocked += 1;
        throw new Error("Mismatched Liner recording fingerprint.");
      }
      counts.replayed += 1;
    } else {
      if (mode === "replay") {
        counts.blocked += 1;
        throw new Error("Missing Liner recording.");
      }
      counts.fetched += 1;
      let response: Response;
      let body: string;
      try {
        response = await fetch(input, options);
        body = response.ok ? await response.text() : "";
      } catch (error) {
        counts.networkErrors += 1;
        throw error;
      }
      record = {
        fingerprint, inputHash, apiVersion, recordedAt: new Date().toISOString(), status: response.status,
        retryAfter: response.headers.get("Retry-After"), body,
      };
      // Public search results are local replay data. Never put this cache or request headers in Git.
      if (response.ok) {
        await mkdir(directory, { recursive: true });
        await writeFile(path, JSON.stringify(record) + "\n");
      }
    }
    counts.statuses[record.status] = (counts.statuses[record.status] ?? 0) + 1;
    return new Response(record.status === 200 ? record.body : null, {
      status: record.status, headers: record.retryAfter ? { "Retry-After": record.retryAfter } : undefined,
    });
  };
  return { counts, fetcher };
}

type Prediction = { id: string; verdict: Verdict; handoff: Handoff; region: string | null; reason: string; details: Assessment["details"] };

function compare(predictions: Prediction[], answers: Map<string, Expected>) {
  const matrix = Object.fromEntries(VERDICTS.map((expected) => [
    expected, Object.fromEntries(VERDICTS.map((actual) => [actual, 0])),
  ]));
  const mismatches = [];
  const handoffMismatches = [];
  const handoffGroups = { valid: { correct: 0, total: 0 }, other: { correct: 0, total: 0 } };
  const predictedAmbiguousHandoffs: Partial<Record<Handoff, number>> = {};
  const evidenceStatus: Partial<Record<string, number>> = {};
  for (const actual of predictions) {
    const expected = answers.get(actual.id);
    if (!expected) throw new Error("Missing answer for " + actual.id);
    matrix[expected.verdict][actual.verdict] += 1;
    if (expected.verdict !== actual.verdict) mismatches.push({ id: actual.id, expected: expected.verdict, actual: actual.verdict, reason: actual.reason, details: actual.details });
    const { handoff } = actual;
    if (actual.verdict === "ambiguous") predictedAmbiguousHandoffs[handoff] = (predictedAmbiguousHandoffs[handoff] ?? 0) + 1;
    const status = actual.details?.externalStatus;
    if (status) evidenceStatus[status] = (evidenceStatus[status] ?? 0) + 1;
    if (handoffExclusions.has(actual.id)) continue;
    const valid = expected.verdict === "valid";
    const group = handoffGroups[valid ? "valid" : "other"];
    group.total += 1;
    const matched = valid ? (expected.handoff === "dealer") === (handoff === "dealer") : expected.handoff === handoff;
    if (matched) group.correct += 1;
    else handoffMismatches.push({ id: actual.id, expected: expected.handoff, actual: handoff, region: actual.region });
  }
  return {
    verdict: { correct: predictions.length - mismatches.length, total: predictions.length },
    handoff: { correct: handoffGroups.valid.correct + handoffGroups.other.correct, total: handoffGroups.valid.total + handoffGroups.other.total },
    handoffGroups, matrix, validToInvalid: matrix.valid.invalid, validToAmbiguous: matrix.valid.ambiguous,
    predictedAmbiguousHandoffs, evidenceStatus, mismatches, handoffMismatches,
  };
}

function jsonAnswers(serialized: string, leads: LeadInput[]) {
  const data = JSON.parse(serialized) as {
    sourceHash: string;
    labelsHash: string;
    answers: { id: string; verdict: Verdict; handoff: Handoff }[];
  };
  const remaining = new Set(leads.map(({ id }) => id));
  if (!/^[a-f0-9]{64}$/u.test(data.sourceHash) || !Array.isArray(data.answers)
    || data.labelsHash !== digest(JSON.stringify(data.answers))
    || !data.answers.every(({ id, verdict, handoff }) =>
      remaining.delete(id) && VERDICTS.includes(verdict) && handoffs.includes(handoff))
    || remaining.size !== 0) throw new Error("Invalid normalized HJ answer file.");
  return data;
}

async function main() {
  const [mode, answersPath] = process.argv.slice(2);
  if (!["sample", "capture", "replay", "labels"].includes(mode) || !answersPath) {
    throw new Error("Usage: evaluate-final-forwarding.ts <sample|capture|replay|labels> <HJ JSON or CSV>");
  }
  const apiKey = mode === "capture" ? process.env.LINER_API_KEY?.trim() : "offline-replay";
  if (!apiKey) throw new Error("LINER_API_KEY is required to capture a recording.");
  const [markdown, answerFile] = await Promise.all([readFile("docs/product/EVAL_DATA.md", "utf8"), readFile(answersPath, "utf8")]);
  const demo = createInitialForwardingState().leads;
  const heldOut = heldOutInputs(markdown);
  const normalized = answersPath.endsWith(".json") ? jsonAnswers(answerFile, heldOut) : null;
  const sourceHash = normalized?.sourceHash ?? digest(answerFile);
  if (mode === "labels") {
    if (normalized) throw new Error("Label conversion requires the original HJ CSV.");
    const answers = [...heldOutAnswers(answerFile, heldOut)].map(([id, answer]) => ({ id, ...answer }));
    console.log(JSON.stringify({ sourceHash, labelsHash: digest(JSON.stringify(answers)), answers }, null, 2));
    return;
  }
  const config = mode === "sample" ? { mode } : { mode: "live", apiKey };
  const measure = async (leads: LeadInput[], answerHash: string) => {
    const transport = searchTransport(mode, digest(JSON.stringify([leads, answerHash])));
    const service = createAssessmentService({ fetcher: transport.fetcher });
    const predictions = [];
    for (const lead of leads) {
      const { assessment } = await service.assess(lead, config);
      if (!assessment.handoff) throw new Error("Missing fresh assessment handoff.");
      predictions.push({
        id: lead.id, verdict: assessment.verdict, reason: assessment.reason, details: assessment.details,
        handoff: assessment.handoff.kind, region: assessment.handoff.kind === "regional-sales" ? assessment.handoff.region : null,
      });
      if (mode === "capture" && (transport.counts.networkErrors || transport.counts.statuses[401] || transport.counts.statuses[403])) {
        throw new Error("Liner access failed; capture stopped without scoring partial results.");
      }
    }
    if (transport.counts.blocked || (mode !== "sample" && predictions.some((row) => row.details?.externalStatus === "failed"))) {
      throw new Error("Search capture/replay incomplete; partial predictions were excluded.");
    }
    return { predictions, calls: transport.counts };
  };
  const demoResult = await measure(demo, digest(JSON.stringify(demoAnswers)));
  const heldOutResult = await measure(heldOut, sourceHash);
  const demoKey = new Map<string, Expected>(demoAnswers.map(({ leadId, verdict, handoff }) => [
    leadId, { verdict: verdict as Verdict, handoff: handoff.kind as Handoff },
  ]));
  const heldOutKey = normalized
    ? new Map<string, Expected>(normalized.answers.map(({ id, verdict, handoff }) => [id, { verdict, handoff }]))
    : heldOutAnswers(answerFile, heldOut);
  console.log(JSON.stringify({
    mode,
    demo: { ...compare(demoResult.predictions, demoKey), calls: demoResult.calls },
    heldOut: { ...compare(heldOutResult.predictions, heldOutKey), calls: heldOutResult.calls },
  }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Evaluation failed.");
  process.exitCode = 1;
});
