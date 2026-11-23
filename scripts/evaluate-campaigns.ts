import { readFileSync } from "node:fs";
import { campaignEffect, demoCampaigns, evaluationCampaignForLead, type AcquisitionCode } from "../src/lib/marketing/campaign-policy";

type Verdict = "valid" | "ambiguous" | "country-check" | "partnership-check" | "invalid";
type EvaluationVerdict = { id: string; verdict: Verdict };
type ArchivedPrediction = EvaluationVerdict & { campaign: AcquisitionCode };
type CampaignStats = {
  code: AcquisitionCode;
  label: string;
  total: number;
  engineValid: number;
  hjValid: number;
  validToAmbiguous: number;
  validToOther: number;
  falseValid: number;
};
const verdicts = new Map<string, Verdict>([
  ["유효", "valid"], ["애매", "ambiguous"], ["국가 확인", "country-check"],
  ["제휴 확인", "partnership-check"], ["무효", "invalid"],
]);
const validVerdicts = new Set(verdicts.values());
const readEvaluation = (file: string) => readFileSync(new URL("../docs/qa/" + file, import.meta.url), "utf8");

function correctedAnswers(csv: string, corrections: readonly EvaluationVerdict[]) {
  // Quoted fields can contain commas, embedded newlines and doubled quotes.
  const records = csv.trimEnd().match(/(?:[^"\r\n]|"(?:[^"]|"")*")+/gu) ?? [];
  if (!records.shift()?.startsWith("ID,")) throw new Error("Missing HJ answer header.");
  const answers = new Map<string, Verdict>();
  for (const record of records) {
    const fields = [...record.matchAll(/(?:^|,)(?:"((?:[^"]|"")*)"|([^",\r\n]*))/gu)]
      .map((match) => (match[1]?.replaceAll('""', '"') ?? match[2]).trim());
    const id = fields[0];
    const verdict = verdicts.get(fields[6]);
    if (fields.length !== 9 || !evaluationCampaignForLead(id) || answers.has(id) || !verdict) {
      throw new Error("Invalid or duplicate HJ answer.");
    }
    answers.set(id, verdict);
  }
  if (answers.size !== 70) throw new Error("Expected 70 HJ answers.");

  const corrected = new Set<string>();
  for (const { id, verdict } of corrections) {
    if (!answers.has(id) || corrected.has(id) || !validVerdicts.has(verdict) || answers.get(id) === verdict) {
      throw new Error("Invalid or duplicate HJ answer correction.");
    }
    answers.set(id, verdict);
    corrected.add(id);
  }
  return answers;
}

const answers = correctedAnswers(
  readEvaluation("EVAL_ANSWERS_HJ.csv"),
  JSON.parse(readEvaluation("EVAL_ANSWERS_HJ_CORRECTIONS_2026-11-21.json")),
);
const predictions = JSON.parse(readEvaluation("EVAL_70_ROUTER_REPLAY_2026-11-23.json")) as ArchivedPrediction[];
const campaignLabels: readonly (readonly [AcquisitionCode, string])[] = [
  ...demoCampaigns.map(({ code, channelLabel }) => [code, channelLabel] as const),
  ["direct", "직접 유입"],
];
const groups = new Map<AcquisitionCode, CampaignStats>(campaignLabels.map(([code, label]) => [code, {
  code, label, total: 0, engineValid: 0, hjValid: 0, validToAmbiguous: 0, validToOther: 0, falseValid: 0,
}]));
const seen = new Set<string>();
let verdictMatches = 0;
for (const { id, campaign, verdict } of predictions) {
  const group = groups.get(campaign);
  const answer = answers.get(id);
  if (!group || !answer || seen.has(id) || !validVerdicts.has(verdict) || campaign !== evaluationCampaignForLead(id)) {
    throw new Error("Invalid or duplicate archived prediction or campaign.");
  }
  seen.add(id);
  group.total++;
  if (verdict === answer) verdictMatches++;
  if (verdict === "valid") group.engineValid++;
  if (answer === "valid") {
    group.hjValid++;
    if (verdict === "ambiguous") group.validToAmbiguous++;
    else if (verdict !== "valid") group.validToOther++;
  } else if (verdict === "valid") {
    group.falseValid++;
  }
}

if (seen.size !== answers.size || [...groups.values()].some(({ total }) => total !== 14)) {
  throw new Error("Expected 14 archived predictions in each of the five acquisition groups.");
}
const result = {
  verdictMatches,
  total: seen.size,
  campaigns: [...groups.values()].map((group) => ({
    ...group,
    engineEffect: group.code === "direct" ? null : campaignEffect(group.total, group.engineValid),
    hjEffect: group.code === "direct" ? null : campaignEffect(group.total, group.hjValid),
  })),
};

const value = (valid: number, total: number) => valid + "/" + total + " (" + (100 * valid / total).toFixed(1) + "%)";
const markdownRows = result.campaigns.map(({ code, label, total, engineValid, hjValid, engineEffect, hjEffect, validToAmbiguous }) =>
  "| " + (code === "direct" ? label : code + " " + label) + " | " + total
  + " | " + value(engineValid, total) + " · " + (engineEffect ?? "—")
  + " | " + value(hjValid, total) + " · " + (hjEffect ?? "—")
  + " | " + validToAmbiguous + " |");
const output = [
  "판정 일치 " + result.verdictMatches + "/" + result.total,
  "",
  "| 유입 경로 | 유입 | 미리내 유효 비율 · 효과 | HJ 정정 유효 비율 · 효과 | HJ 유효 → 미리내 애매 |",
  "| --- | ---: | --- | --- | ---: |",
  ...markdownRows,
].join("\n");
console.log(process.argv.includes("--json") ? JSON.stringify(result, null, 2) : output);
