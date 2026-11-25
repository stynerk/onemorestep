import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { POST as assess } from "../src/app/api/forwarding/assess/route";
import { POST as mail } from "../src/app/api/forwarding/mail/route";
import demoTruth from "../src/lib/forwarding/evaluation/ground-truth.json";
import { createInitialForwardingState } from "../src/lib/forwarding/seed";
import type { Assessment, AssessmentHandoff, Verdict } from "../src/lib/forwarding/types";
import { routingReplayRow } from "./routing-replay";

type Route = ReturnType<typeof routingReplayRow>;
type Comparison = { route: Route; verdict: Verdict; handoff: string };
const parse = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const demo = createInitialForwardingState();
const verdicts = new Map<string, Verdict>([
  ["유효", "valid"], ["애매", "ambiguous"], ["국가 확인", "country-check"], ["제휴 확인", "partnership-check"], ["무효", "invalid"],
]);

function handoffKey(handoff: AssessmentHandoff | undefined, country: string): string {
  assert.ok(handoff);
  if (handoff.kind === "regional-sales") return "regional-sales:" + (handoff.region ?? "unassigned");
  if (handoff.kind !== "dealer") return handoff.kind;
  const dealer = demo.dealers.find(({ id }) => id === handoff.dealerId);
  assert.ok(dealer?.countries.includes(country));
  return "dealer:" + country;
}

function blindTarget(label: string, country: string) {
  if (label === "없음") return "none";
  if (label === "인사팀") return "hr";
  if (label === country + " 딜러") return "dealer:" + country;
  const region = /^(NA|EU|APAC|LATAM|MEA) 세일즈팀$/u.exec(label);
  assert.ok(region);
  return "regional-sales:" + region[1];
}

function summarize(rows: Comparison[], stage: "before" | "after") {
  const totals = {
    size: rows.length, verdictMatch: 0, handoffMatch: 0, unassigned: 0,
    humanAmbiguous: 0, automatic: 0, automaticAgrees: 0, freeEmail: 0, weakIntent: 0,
    r3Agrees: 0, freeEmailAgrees: 0, weakIntentAgrees: 0, validToInvalid: 0, falseValid: 0,
    humanReasons: { impersonation: 0, externalFailure: 0, unverifiedPurchase: 0, other: 0 },
    r3LabelDisagreements: { valid: 0, "country-check": 0, "partnership-check": 0, invalid: 0 },
  };
  for (const { route, verdict, handoff } of rows) {
    const target = handoffKey(route[stage], route.country);
    const r3 = stage === "after" ? route.confirmation : null;
    const automatic = route.verdict === "country-check" || route.verdict === "partnership-check" || r3 !== null;
    totals.verdictMatch += Number(route.verdict === verdict);
    totals.handoffMatch += Number(target === handoff);
    totals.unassigned += Number(target === "regional-sales:unassigned");
    totals.humanAmbiguous += Number(route.verdict === "ambiguous" && !r3);
    if (stage === "after" && route.humanReason) totals.humanReasons[route.humanReason]++;
    totals.automatic += Number(automatic);
    totals.automaticAgrees += Number(automatic && route.verdict === verdict);
    totals.freeEmail += Number(r3 === "free-email");
    totals.weakIntent += Number(r3 === "weak-intent");
    totals.r3Agrees += Number(Boolean(r3) && route.verdict === verdict);
    totals.freeEmailAgrees += Number(r3 === "free-email" && route.verdict === verdict);
    totals.weakIntentAgrees += Number(r3 === "weak-intent" && route.verdict === verdict);
    if (r3 && verdict !== "ambiguous") totals.r3LabelDisagreements[verdict]++;
    totals.validToInvalid += Number(verdict === "valid" && route.verdict === "invalid");
    totals.falseValid += Number(verdict !== "valid" && route.verdict === "valid");
  }
  if (stage === "after") {
    assert.equal(Object.values(totals.humanReasons).reduce((sum, count) => sum + count, 0), totals.humanAmbiguous);
  }
  return totals;
}

const comparison = (rows: Comparison[]) => ({ before: summarize(rows, "before"), after: summarize(rows, "after") });

function largeComparison() {
  const routes: Route[] = parse(".cache/large-eval-x/routing.json");
  const { measurement } = JSON.parse(execFileSync(process.execPath,
    ["--import", "tsx", "scripts/score-large-evaluation.ts", "score"], { encoding: "utf8" })) as {
      measurement: { mismatches: { id: string; reference: { verdict: Verdict; handoff: string } }[] };
    };
  const reference = new Map(measurement.mismatches.map(({ id, reference }) => [id, reference]));
  const rows = routes.map((route): Comparison => ({
    route, ...(reference.get(route.id) ?? { verdict: route.verdict, handoff: handoffKey(route.before, route.country) }),
  }));
  assert.equal(rows.length, 1000);
  const original = comparison(rows);
  const mapping: { id: string; type: string }[] = parse(".cache/large-eval-sheet/private-index.json").mapping;
  const byType = new Map(mapping.map(({ id, type }) => [id, type]));
  assert.equal(rows.filter(({ route }) => byType.get(route.id) === "F").length, 100);
  const hj = comparison(rows.map((row) => byType.get(row.route.id) === "F"
    ? { ...row, verdict: "invalid", handoff: "none" } : row));
  assert.deepEqual([original.before.verdictMatch, original.before.handoffMatch, hj.before.verdictMatch, hj.before.handoffMatch], [579, 528, 679, 628]);
  const r3Types: Record<string, number> = {};
  for (const { route } of rows) {
    if (!route.confirmation) continue;
    const key = route.confirmation + ":" + byType.get(route.id);
    r3Types[key] = (r3Types[key] ?? 0) + 1;
  }
  return { original, hj, r3Types };
}

function blindComparison() {
  const routes: Route[] = parse(".cache/eval2/routing.json");
  const { results }: { results: { id: string; expected: string; expectedHandoff: string }[] } = parse(".cache/eval2/score.json");
  assert.deepEqual(routes.map(({ id }) => id), results.map(({ id }) => id));
  const scored = comparison(routes.map((route, index): Comparison => {
    const { expected, expectedHandoff } = results[index];
    const verdict = verdicts.get(expected);
    assert.ok(verdict);
    return { route, verdict, handoff: blindTarget(expectedHandoff, route.country) };
  }));
  assert.deepEqual([scored.before.size, scored.before.verdictMatch, scored.before.handoffMatch], [30, 17, 21]);
  return { ...scored, r3Ids: routes.filter((row) => row.confirmation).map(({ id, confirmation }) => ({ id, confirmation })) };
}

async function demoComparison() {
  process.env.MIRINAE_DEMO_TARGET = "public";
  let networkCalls = 0;
  globalThis.fetch = async () => {
    networkCalls++;
    throw new Error("The public replay must never request the network.");
  };
  const rows: Comparison[] = [];
  for (const [index, lead] of demo.leads.entries()) {
    const request = new Request("http://localhost/api/forwarding/assess", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadId: lead.id }),
    });
    const response = await assess(request);
    assert.equal(response.status, 200, lead.id);
    const { assessment, workflow } = await response.json() as { assessment: Assessment; workflow: string };
    assert.equal(assessment.mode, "saved", lead.id);
    const expected = demoTruth[index];
    assert.equal(expected.leadId, lead.id);
    const route = routingReplayRow(lead, assessment);
    if (assessment.verdict === "ambiguous") {
      assert.equal(workflow === "reply-pending", Boolean(route.confirmation), lead.id);
    }
    rows.push({ route, verdict: expected.verdict as Verdict,
      handoff: handoffKey(expected.handoff as AssessmentHandoff, lead.country) });
  }
  const blocked = await mail(new Request("http://localhost/api/forwarding/mail", { method: "POST" }));
  const scored = comparison(rows);
  assert.deepEqual([scored.before.size, scored.before.verdictMatch, scored.after.verdictMatch, blocked.status, networkCalls], [30, 30, 30, 403, 0]);
  return { ...scored, mailStatus: blocked.status, networkCalls,
    r3Ids: rows.filter(({ route }) => route.confirmation).map(({ route }) => ({ id: route.id, confirmation: route.confirmation })) };
}

async function main() {
  console.log(JSON.stringify({ large: largeComparison(), blind: blindComparison(), demo: await demoComparison() }, null, 2));
}
main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
