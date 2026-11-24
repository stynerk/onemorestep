import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createInitialForwardingState } from "../src/lib/forwarding/seed";
import { REGIONS, VERDICTS, type AssessmentHandoff, type Verdict } from "../src/lib/forwarding/types";

const sheetPath = "docs/qa/LARGE_EVAL_1000.csv";
const answerPath = "docs/qa/LARGE_EVAL_1000_ANSWERS_GEMINI.csv";
const indexPath = ".cache/large-eval-sheet/private-index.json";
const enginePath = ".cache/large-eval-x/liner-predictions.json";
const frozenEngine = "ca0cf6e299772744aa5e734fab99dbe96cbed7be";
const header = ["ID", "소속", "이메일", "리드 국가", "상품", "메모",
  "HJ 정답 (유효/애매/국가 확인/제휴 확인/무효)", "넘길 곳 ", "이유·메모 (선택)"];
const verdictByLabel = new Map<string, Verdict>([
  ["유효", "valid"], ["애매", "ambiguous"], ["국가 확인", "country-check"],
  ["제휴 확인", "partnership-check"], ["무효", "invalid"],
]);
const generationCounts = {
  A: 300, B: 50, C: 150, D: 70, E: 30, F: 100, G: 100, H: 50, I: 30, J: 40, K: 30, L: 50,
} as const;
const languageCounts = { ko: 200, en: 350, ja: 100, de: 100, fr: 150, es: 100 } as const;
const intendedInvalidTypes = ["F", "I", "J", "K", "L"] as const;
const cohortIds = Array.from({ length: 1000 }, (_, i) => "X" + String(i + 1).padStart(4, "0"));
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const utf8 = new TextDecoder("utf-8", { fatal: true });

type GenerationType = keyof typeof generationCounts;
type Language = keyof typeof languageCounts;
type PrivateIndex = { seed: number; sheetSha256: string; mapping: { id: string; type: GenerationType; language: Language }[] };
type EngineRow = { id: string; verdict: Verdict; handoff?: AssessmentHandoff | null; failures?: unknown[] };
type EngineRun = { engine: string; inputSha256: string; counts: unknown; predictions: EngineRow[] };
type LabelRow = { id: string; country: string; verdict: Verdict; handoff: string; type: GenerationType; language: Language };
type Counts = { total: number; verdictMatches: number; handoffMatches: number; validToInvalid: number; falseValid: number };
const emptyCounts = (): Counts => ({ total: 0, verdictMatches: 0, handoffMatches: 0, validToInvalid: 0, falseValid: 0 });
const verdictCounts = () => Object.fromEntries(VERDICTS.map((verdict) => [verdict, 0])) as Record<Verdict, number>;
const sumVerdicts = (counts: Record<Verdict, number>) => Object.values(counts).reduce((sum, count) => sum + count, 0);

function readCsv(source: Buffer) {
  const csv = utf8.decode(source);
  const records: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let state: "unquoted" | "quoted" | "closed" = "unquoted";
  const appendCell = () => {
    row.push(cell);
    cell = "";
    state = "unquoted";
  };
  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    if (state === "quoted") {
      if (char === '"') {
        if (csv[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          state = "closed";
        }
      } else {
        cell += char;
      }
    } else if (char === ",") {
      appendCell();
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && csv[i + 1] === "\n") i++;
      appendCell();
      records.push(row);
      row = [];
    } else if (char === '"') {
      assert.ok(state === "unquoted" && !cell, "Unexpected quote in CSV field");
      state = "quoted";
    } else {
      assert.equal(state, "unquoted", "Unexpected characters after closing CSV quote");
      cell += char;
    }
  }
  assert.notEqual(state, "quoted", "Unterminated quoted CSV field");
  if (row.length || cell || state === "closed") {
    appendCell();
    records.push(row);
  }
  assert.deepEqual(records.shift(), header);
  assert.ok(records.every((record) => record.length === header.length), "Unexpected CSV column count");
  return records;
}

function indexById<T extends { id: string }>(rows: T[], kind: string) {
  assert.ok(Array.isArray(rows), kind + " must be an array");
  const joined = new Map(rows.map((row) => [row.id, row]));
  assert.equal(joined.size, rows.length, "Duplicate ID in " + kind);
  assert.deepEqual([...joined.keys()].sort(), cohortIds, "Missing or unexpected ID in " + kind);
  return joined;
}

function answerHandoff(rawTarget: string, verdict: Verdict, countries: Set<string>, id: string) {
  const target = rawTarget.trim();
  if (!target) {
    assert.equal(verdict, "invalid", "Unexpected blank reference handoff for " + id);
    return "none";
  }
  if (target === "인사팀") return "hr";
  if (target === "없음") return "none";
  const dealerCountry = /^(\S(?:.*\S)?)\s+딜러$/u.exec(target)?.[1];
  if (dealerCountry) {
    assert.ok(countries.has(dealerCountry), "Unknown reference dealer country for " + id);
    return "dealer:" + dealerCountry;
  }
  const region = REGIONS.find((code) => target === code + " 세일즈팀");
  assert.ok(region, "Unknown reference handoff for " + id);
  return "regional-sales:" + region;
}

function readReference() {
  const sheet = readFileSync(sheetPath);
  const answers = readFileSync(answerPath);
  const sheetSha256 = hash(sheet);
  const sheetRows = readCsv(sheet);
  assert.deepEqual(sheetRows.map(([id]) => id), cohortIds, "Sheet must have ordered X0001 through X1000");
  const answerRows = indexById(readCsv(answers).map((cells) => ({ id: cells[0], cells })), "answers");
  const metadata = JSON.parse(readFileSync(indexPath, "utf8")) as PrivateIndex;
  assert.equal(metadata.seed, 20261125);
  assert.equal(metadata.sheetSha256, sheetSha256, "Private index belongs to a different sheet");
  const index = indexById(metadata.mapping, "private index");
  const countries = new Set(sheetRows.map((row) => row[3]));
  const byType = Object.fromEntries(Object.keys(generationCounts).map((type) => [type, verdictCounts()])) as Record<GenerationType, Record<Verdict, number>>;
  const byLanguage = Object.fromEntries(Object.keys(languageCounts).map((lang) => [lang, verdictCounts()])) as Record<Language, Record<Verdict, number>>;
  const verdicts = verdictCounts();
  const handoffs: Record<string, number> = {};
  let blankHandoffs = 0;

  const labels = sheetRows.map((columns): LabelRow => {
    const [id, , , country] = columns;
    assert.ok(columns.slice(6).every((value) => value === ""), "Reference data leaked into measurement inputs");
    const actual = answerRows.get(id)!.cells;
    assert.deepEqual(actual.slice(0, 6), columns.slice(0, 6), "Answer inputs differ for " + id);
    assert.ok(actual[8].trim(), "Missing reference explanation for " + id);
    const verdict = verdictByLabel.get(actual[6].trim());
    assert.ok(verdict, "Unknown reference verdict for " + id);
    const handoff = answerHandoff(actual[7], verdict, countries, id);
    blankHandoffs += Number(!actual[7].trim());
    const { type, language } = index.get(id)!;
    assert.ok(Object.hasOwn(byType, type) && Object.hasOwn(byLanguage, language), "Unknown generation cohort for " + id);
    verdicts[verdict]++;
    byType[type][verdict]++;
    byLanguage[language][verdict]++;
    handoffs[handoff] = (handoffs[handoff] ?? 0) + 1;
    return { id, country, verdict, handoff, type, language };
  });
  for (const type of Object.keys(generationCounts) as GenerationType[]) {
    assert.equal(sumVerdicts(byType[type]), generationCounts[type], "Unexpected generation count for " + type);
  }
  for (const language of Object.keys(languageCounts) as Language[]) {
    assert.equal(sumVerdicts(byLanguage[language]), languageCounts[language], "Unexpected language count for " + language);
  }
  const subset = verdictCounts();
  for (const type of intendedInvalidTypes) {
    for (const verdict of VERDICTS) subset[verdict] += byType[type][verdict];
  }
  return {
    labels, sheetSha256, answersSha256: hash(answers), reference: { verdicts, handoffs, blankHandoffs },
    generation: { byType, byLanguage, intendedInvalid: { types: intendedInvalidTypes, total: sumVerdicts(subset), verdicts: subset } },
  };
}

const dealers = new Map(createInitialForwardingState().dealers.map((dealer) => [dealer.id, dealer]));

function engineHandoff(value: EngineRow["handoff"], lead: LabelRow) {
  if (!value) return "missing";
  if (value.kind === "none" || value.kind === "hr") return value.kind;
  if (value.kind === "regional-sales") {
    assert.ok(value.region === null || REGIONS.includes(value.region), "Unknown engine region for " + lead.id);
    return "regional-sales:" + (value.region ?? "unassigned");
  }
  assert.equal(value.kind, "dealer", "Unknown engine handoff kind for " + lead.id);
  const dealer = dealers.get(value.dealerId);
  assert.ok(dealer, "Unknown engine dealer for " + lead.id);
  const country = dealer.countries.length === 1 ? dealer.countries[0] : dealer.countries.find((c) => c === lead.country);
  assert.ok(country, "Undetermined engine dealer country for " + lead.id);
  return "dealer:" + country;
}

function handoffKind(target: string) {
  return target === "regional-sales:unassigned" ? target : target.split(":")[0];
}

function addTransition(matrix: Record<string, Record<string, number>>, from: string, to: string) {
  const counts = matrix[from] ??= {};
  counts[to] = (counts[to] ?? 0) + 1;
}

function score(labels: LabelRow[], sheetSha256: string) {
  const bytes = readFileSync(enginePath);
  const run = JSON.parse(utf8.decode(bytes)) as EngineRun;
  assert.equal(run.engine, frozenEngine, "Bad frozen engine commit");
  assert.equal(run.inputSha256, sheetSha256, "Measurement used a different input sheet");
  const predictions = indexById(run.predictions, "Liner predictions");
  const total = emptyCounts();
  const byType = Object.fromEntries(Object.keys(generationCounts).map((type) => [type, emptyCounts()])) as Record<GenerationType, Counts>;
  const byLanguage = Object.fromEntries(Object.keys(languageCounts).map((language) => [language, emptyCounts()])) as Record<Language, Counts>;
  const transition = Object.fromEntries(VERDICTS.map((label) => [label, verdictCounts()])) as Record<Verdict, Record<Verdict, number>>;
  const handoffTransition: Record<string, Record<string, number>> = {};
  const handoffKindTransition: Record<string, Record<string, number>> = {};
  const predictedVerdicts = verdictCounts();
  const predictedHandoffs: Record<string, number> = {};
  const mismatches = [];
  let upstreamErrorCases = 0;
  for (const lead of labels) {
    const predicted = predictions.get(lead.id)!;
    assert.ok(VERDICTS.includes(predicted.verdict), "Unknown engine verdict for " + lead.id);
    const target = engineHandoff(predicted.handoff, lead);
    const verdictMatch = lead.verdict === predicted.verdict;
    const handoffMatch = lead.handoff === target;
    for (const stats of [total, byType[lead.type], byLanguage[lead.language]]) {
      stats.total++;
      stats.verdictMatches += Number(verdictMatch);
      stats.handoffMatches += Number(handoffMatch);
      stats.validToInvalid += Number(lead.verdict === "valid" && predicted.verdict === "invalid");
      stats.falseValid += Number(lead.verdict !== "valid" && predicted.verdict === "valid");
    }
    transition[lead.verdict][predicted.verdict]++;
    addTransition(handoffTransition, lead.handoff, target);
    addTransition(handoffKindTransition, handoffKind(lead.handoff), handoffKind(target));
    predictedVerdicts[predicted.verdict]++;
    predictedHandoffs[target] = (predictedHandoffs[target] ?? 0) + 1;
    upstreamErrorCases += Number(Boolean(predicted.failures?.length));
    if (!verdictMatch || !handoffMatch) {
      mismatches.push({
        id: lead.id, type: lead.type, language: lead.language,
        reference: { verdict: lead.verdict, handoff: lead.handoff },
        engine: { verdict: predicted.verdict, handoff: target },
      });
    }
  }
  return {
    engine: run.engine, predictionsFileSha256: hash(bytes), counts: run.counts, upstreamErrorCases,
    total, byType, byLanguage, transition, handoffTransition, handoffKindTransition, predictedVerdicts, predictedHandoffs, mismatches,
  };
}

const [mode, ...extra] = process.argv.slice(2);
assert.ok(!extra.length && (mode === "validate" || mode === "score"),
  "Usage: node --import tsx scripts/score-large-evaluation.ts validate|score");
const { labels, ...referenceSummary } = readReference();
const result = mode === "score" ? { ...referenceSummary, measurement: score(labels, referenceSummary.sheetSha256) } : referenceSummary;
console.log(JSON.stringify(result, null, 2));
