import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createInitialForwardingState } from "../src/lib/forwarding/seed";
import { REGIONS, VERDICTS } from "../src/lib/forwarding/types";

const evidence = new URL("../docs/qa/large-eval/", import.meta.url);
const read = (name: string) => readFileSync(new URL(name, evidence), "utf8");
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const readJson = (name: string) => JSON.parse(read(name));
const ko = ["유효", "애매", "국가 확인", "제휴 확인", "무효"] as const;
type Verdict = (typeof VERDICTS)[number] | "unknown";
type Handoff = { kind: string; country?: string; region?: string | null; dealerId?: string };
type RawLabel = { id: string; verdict: Verdict; handoff: Handoff };
type Label = { id: string; verdict: Verdict; handoff: string };
type Group = { id: string; group: string };
type GeminiMetadata = {
  model: string;
  apiVersion: string;
  transport?: string;
  batchSize: number;
  prompt: string;
  promptSha256: string;
  labelsSha256: string;
  generationConfig: unknown;
  total: number;
};

function readGemini(set: "human" | "generated") {
  const labels = read("gemini-" + set + ".json").replaceAll("\r\n", "\n");
  const metadata = readJson("gemini-" + set + "-metadata.json") as GeminiMetadata;
  assert.equal(digest(labels), metadata.labelsSha256, "Gemini labels differ from the capture manifest");
  assert.equal(digest(metadata.prompt), metadata.promptSha256, "Gemini prompt differs from the capture manifest");
  const rows = JSON.parse(labels) as RawLabel[];
  assert.ok(Array.isArray(rows));
  assert.equal(rows.length, metadata.total);
  return { rows, metadata };
}

function labelingMethod(metadata: GeminiMetadata) {
  const { model, apiVersion, transport, batchSize, promptSha256, generationConfig } = metadata;
  return { model, apiVersion, transport, batchSize, promptSha256, generationConfig };
}

function csv(source: string, width: number) {
  const [header, ...records] = source.replace(/^\uFEFF/u, "").trimEnd()
    .match(/(?:[^"\r\n]|"(?:[^"]|"")*")+/gu) ?? [];
  assert.ok(header?.split(",").length === width, "Unexpected CSV header");
  return records.map((record) => {
    const fields = [...record.matchAll(/(?:^|,)(?:"((?:[^"]|"")*)"|([^",\r\n]*))/gu)]
      .map((match) => match[1]?.replaceAll('""', '"') ?? match[2]);
    assert.equal(fields.length, width, "Unexpected CSV record width");
    return fields;
  });
}

function sequence(ids: readonly string[], prefix: string, count: number, digits: number) {
  assert.deepEqual(ids, Array.from({ length: count }, (_, index) => prefix + String(index + 1).padStart(digits, "0")));
}

function checked<T extends { id: string }>(rows: T[], ids: string[]) {
  assert.ok(Array.isArray(rows));
  const byId = new Map(rows.map((row) => [row.id, row]));
  assert.equal(byId.size, rows.length, "Duplicate result ID");
  assert.deepEqual([...byId.keys()].sort(), [...ids].sort(), "Incomplete or unexpected result IDs");
  return byId;
}

function humanAnswers() {
  const old = csv(read("../EVAL_ANSWERS_HJ.csv"), 9);
  const blind = csv(read("../EVAL2_ANSWERS_HJ.csv"), 10);
  sequence(old.map(([id]) => id), "E", 70, 2);
  sequence(blind.map(([id]) => id), "N", 30, 2);
  const corrections = readJson("../EVAL_ANSWERS_HJ_CORRECTIONS_2026-11-21.json") as
    { id: string; verdict: "invalid"; handoff: "none" }[];
  const changes = new Map(corrections.map((row) => [row.id, row]));
  assert.equal(changes.size, 11);
  const answers = [...old, ...blind].map(([id, , , , , , label, rawHandoff]): Label => {
    const correction = changes.get(id);
    if (correction) {
      changes.delete(id);
      assert.equal(correction.verdict, "invalid");
      assert.equal(correction.handoff, "none");
      return correction;
    }
    const verdict = VERDICTS[ko.indexOf(label.trim() as (typeof ko)[number])];
    assert.ok(verdict, "Unexpected HJ verdict for " + id);
    const target = rawHandoff.trim();
    if (!target) {
      assert.equal(verdict, "invalid", "Missing HJ handoff for " + id);
      return { id, verdict, handoff: "none" };
    }
    if (target === "인사팀") return { id, verdict, handoff: "hr" };
    if (target.endsWith(" 딜러")) return { id, verdict, handoff: "dealer:" + target.slice(0, -3) };
    const region = REGIONS.find((name) => target === name + " 세일즈팀");
    assert.ok(region, "Unexpected HJ handoff for " + id);
    return { id, verdict, handoff: "regional-sales:" + region };
  });
  assert.equal(changes.size, 0, "Unmatched HJ correction");
  return answers;
}

const dealers = new Map(createInitialForwardingState().dealers.map((dealer) => [dealer.id, dealer]));

function normalize(raw: RawLabel, country: string | undefined, engine: boolean): Label {
  let handoff = raw.handoff?.kind;
  if (handoff === "dealer") {
    if (engine) {
      const dealer = dealers.get(raw.handoff.dealerId ?? "");
      assert.ok(country && dealer?.countries.includes(country), "Unmapped engine dealer for " + raw.id);
      handoff = "dealer:" + country;
    } else {
      const target = raw.handoff.country?.trim();
      assert.ok(target, "Missing Gemini dealer country for " + raw.id);
      handoff = "dealer:" + target;
    }
  } else if (handoff === "regional-sales") {
    assert.ok((engine && raw.handoff.region === null) || REGIONS.some((region) => region === raw.handoff.region),
      "Unexpected region for " + raw.id);
    handoff = "regional-sales:" + (raw.handoff.region ?? "미지정");
  }
  assert.ok([...VERDICTS, "unknown"].includes(raw.verdict), "Unexpected verdict for " + raw.id);
  assert.ok(handoff && (["none", "hr", "unknown"].includes(handoff)
    || handoff.startsWith("dealer:") || handoff.startsWith("regional-sales:")), "Unexpected handoff for " + raw.id);
  return { id: raw.id, verdict: raw.verdict, handoff };
}

function compare(reference: Label[], actual: Label[], groups: Group[]) {
  const ids = reference.map(({ id }) => id);
  const byId = checked(actual, ids);
  const grouping = checked(groups, ids);
  const labels = [...VERDICTS, "unknown"] as const;
  const transition = Object.fromEntries(labels.map((a) => [a, Object.fromEntries(labels.map((b) => [b, 0]))]));
  let verdictMatches = 0;
  let handoffMatches = 0;
  let knownVerdicts = 0;
  let knownHandoffs = 0;
  const mismatches = [];
  const byGroup = new Map<string, { total: number; verdictMatches: number; handoffMatches: number; unknownVerdicts: number; unknownHandoffs: number }>();
  for (const expected of reference) {
    const predicted = byId.get(expected.id)!;
    const key = grouping.get(expected.id)!.group;
    const group = byGroup.get(key) ?? { total: 0, verdictMatches: 0, handoffMatches: 0, unknownVerdicts: 0, unknownHandoffs: 0 };
    byGroup.set(key, group);
    const knownVerdict = expected.verdict !== "unknown" && predicted.verdict !== "unknown";
    const knownHandoff = expected.handoff !== "unknown" && predicted.handoff !== "unknown";
    const verdictMatch = knownVerdict && expected.verdict === predicted.verdict;
    const handoffMatch = knownHandoff && expected.handoff === predicted.handoff;
    knownVerdicts += Number(knownVerdict);
    knownHandoffs += Number(knownHandoff);
    verdictMatches += Number(verdictMatch);
    handoffMatches += Number(handoffMatch);
    transition[expected.verdict][predicted.verdict]++;
    group.total++;
    group.verdictMatches += Number(verdictMatch);
    group.handoffMatches += Number(handoffMatch);
    group.unknownVerdicts += Number(!knownVerdict);
    group.unknownHandoffs += Number(!knownHandoff);
    if (!verdictMatch || !handoffMatch) mismatches.push({ id: expected.id, group: key, expected, predicted });
  }
  return { total: ids.length, knownVerdicts, knownHandoffs, verdictMatches, handoffMatches, transition,
    validToInvalid: transition.valid.invalid,
    falseValid: VERDICTS.filter((label) => label !== "valid").reduce((sum, label) => sum + transition[label].valid, 0),
    byGroup: Object.fromEntries(byGroup), mismatches };
}

const generatedSource = read("leads.csv");
const generated = csv(generatedSource, 8);
const ids = generated.map(([id]) => id);
sequence(ids, "G", 1000, 4);
const country = new Map(generated.map(([id, , , name]) => [id, name]));
const group = generated.map(([id, , , , , , , type]) => ({ id, group: type }));
const answer = humanAnswers();
const geminiHuman = readGemini("human");
const humanLabels = geminiHuman.rows.map((raw) => normalize(raw, undefined, false));
const humanById = checked(humanLabels, answer.map(({ id }) => id));
const bySet = (prefix: string) => {
  const subset = answer.filter(({ id }) => id.startsWith(prefix));
  return compare(subset, subset.map(({ id }) => humanById.get(id)!),
    subset.map(({ id, verdict }) => ({ id, group: verdict })));
};
const validation = {
  all: compare(answer, humanLabels, answer.map(({ id, verdict }) => ({ id, group: verdict }))),
  blind: bySet("N"), evaluation: bySet("E"),
};
if (process.argv[2] === "--human-only") {
  console.log(JSON.stringify({ validation }, null, 2));
} else {
  const gemini = readGemini("generated");
  assert.deepEqual(labelingMethod(gemini.metadata), labelingMethod(geminiHuman.metadata), "Gemini labeling methods differ");
  const engine = readJson("liner-predictions.json") as { engine: string; inputSha256: string; predictions: RawLabel[]; counts: unknown };
  assert.equal(engine.inputSha256, digest(generatedSource), "Scoring input hash differs from Liner runner");
  const reference = gemini.rows.map((raw) => normalize(raw, undefined, false));
  checked(reference, ids);
  const predicted = engine.predictions.map((raw) => normalize(raw, country.get(raw.id), true));
  const intent = ["valid", "ambiguous", "ambiguous", "ambiguous", "ambiguous", "invalid",
    "country-check", "partnership-check", "invalid", "invalid", "invalid", "invalid"] as const;
  const generatedIntent = new Map(intent.map((verdict, index) => [String.fromCharCode(65 + index), verdict]));
  const byId = checked(group, ids);
  const intentCounts = new Map<string, { total: number; matches: number }>();
  for (const { id, verdict } of reference) {
    const type = byId.get(id)!.group;
    const expected = generatedIntent.get(type);
    assert.ok(expected, "Unexpected generation type");
    const tally = intentCounts.get(type) ?? { total: 0, matches: 0 };
    tally.total++;
    tally.matches += Number(verdict === expected);
    intentCounts.set(type, tally);
  }
  console.log(JSON.stringify({
    engine: engine.engine, inputSha256: engine.inputSha256, counts: engine.counts, validation,
    auxiliary: compare(reference, predicted, group),
    generationIntent: Object.fromEntries(intentCounts),
  }, null, 2));
}
