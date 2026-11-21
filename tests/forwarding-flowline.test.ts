import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { POST } from "../src/app/api/forwarding/assess/route";
import { dealerScore, rankAvailableDealers } from "../src/lib/forwarding/dealers";
import { verdictLabels } from "../src/lib/forwarding/inbox";
import { createIndustryState } from "../src/lib/forwarding/industry-demo";
import { getSavedIndustry } from "../src/lib/forwarding/industry-demo.server";
import type { Assessment, AssessmentHandoff, DealerOutcome, ForwardingState } from "../src/lib/forwarding/types";

const document = readFileSync(new URL("../docs/product/INDUSTRY2_DATA.md", import.meta.url), "utf8");
const tables = document.split(/\r?\n/u).filter((line) => line.startsWith("|")).map((line) =>
  line.split("|").slice(1, -1).map((cell) => cell.trim()));
const leadRows = tables.filter(([id]) => /^I\d{2}$/u.test(id));
const industry = getSavedIndustry("b2b-saas");
assert.ok(industry);

test("Flowline operational inputs and dated partner history reproduce the authoring tables", () => {
  const state = createIndustryState(industry.demo);
  assert.equal(leadRows.length, 10);
  assert.deepEqual(
    state.leads.map(({ id, institution, email, country, product, memo }) => [id, institution, email, country, product, memo]),
    leadRows.map((row) => row.slice(0, 6)),
  );
  assert.ok(state.leads.every(({ receivedAt }, index) =>
    receivedAt === new Date(receivedAt).toISOString() && (!index || receivedAt > state.leads[index - 1].receivedAt)));

  const partnerRows = tables.filter((row) => row.length === 8 && /^\d+$/u.test(row[2]));
  const outcomes: DealerOutcome[] = ["deal", "no-deal", "in-progress", "no-response"];
  assert.equal(partnerRows.length, 7);
  assert.equal(state.dealers.length, partnerRows.length);
  assert.equal(state.deliveries.length, 41);
  for (const [name, country, forwarded, ...counts] of partnerRows) {
    const dealer = state.dealers.find((candidate) => candidate.name === name);
    assert.ok(dealer, name);
    assert.deepEqual(dealer.countries, [country]);
    assert.deepEqual(dealer.products, ["FL-Team", "FL-Enterprise", "FL-API"]);
    const deliveries = state.deliveries.filter((row) => row.dealerId === dealer.id);
    assert.equal(deliveries.length, Number(forwarded), name);
    assert.deepEqual(outcomes.map((outcome) => deliveries.filter((row) => row.outcome === outcome).length), counts.slice(0, 4).map(Number), name);
  }
  const deliveryDates = state.deliveries.map(({ forwardedAt, institution, leadId }) => {
    assert.equal(forwardedAt, new Date(forwardedAt).toISOString());
    assert.ok(state.leads.every((lead) => lead.institution !== institution && lead.id !== leadId));
    return forwardedAt.slice(0, 10);
  }).sort();
  assert.equal(deliveryDates[0], "2026-08-20");
  assert.equal(deliveryDates.at(-1), "2026-11-17");
  assert.equal(new Set(state.deliveries.map(({ id }) => id)).size, state.deliveries.length);
  assert.equal(state.policy?.aggregationDays, 90);
  assert.equal(state.policy?.minimumForwardedCount, 3);
  assert.equal(state.policy?.responseBusinessDays, 1);
  assert.equal(state.policy?.responseTimeZone, "Asia/Seoul");
  assert.deepEqual(state.policy?.weights, { noResponse: -0.1, priorRelationship: 0.1 });
  assert.deepEqual(state.policy?.countryRegions, {
    대한민국: "APAC", 일본: "APAC", 싱가포르: "APAC", 미국: "NA", 캐나다: "NA", 독일: "EU",
  });
  assert.deepEqual(state.policy?.customerIndustries?.["FL-Team"], ["제조", "금융", "IT 서비스", "연구기관", "공공"]);
});

test("the I02 policy data gives the ranking advantage to the existing relationship partner", () => {
  const state = createIndustryState(industry.demo);
  const lead = state.leads.find(({ id }) => id === "I02");
  const dealer = state.dealers.find(({ name }) => name === "Seoul Cloud Partners");
  assert.ok(lead && dealer);
  assert.deepEqual(state.priorRelationships, [{ dealerId: dealer.id, institution: lead.institution }]);
  const scored = dealerScore(state, lead, dealer);
  assert.equal(scored.priorRelationship, true);
  assert.equal(scored.forwarded, 8);
  const recommendation = rankAvailableDealers(state, lead);
  assert.equal(recommendation.route, "dealer");
  if (recommendation.route !== "dealer") throw new Error("Expected ranked partners");
  assert.deepEqual(recommendation.ranked.map(({ dealer, score }) => [dealer.name, score.toFixed(2)]), [
    ["Seoul Cloud Partners", "0.53"], ["K-Integrate", "0.03"],
  ]);
});

function handoffLabel(handoff: AssessmentHandoff | undefined, state: ForwardingState): string {
  if (!handoff) return "미판정";
  switch (handoff.kind) {
    case "dealer":
      return "파트너: " + state.dealers.find((dealer) => dealer.id === handoff.dealerId)?.name;
    case "regional-sales":
      return "권역 세일즈팀(" + handoff.region + ")";
    case "hr":
      return "인사팀";
    case "none":
      return "없음";
  }
}

test("offline Flowline assessment reports verdict and handoff against the independent author rows", async (t) => {
  const previousTarget = process.env.MIRINAE_DEMO_TARGET;
  const originalFetch = globalThis.fetch;
  let upstreamCalls = 0;
  process.env.MIRINAE_DEMO_TARGET = "public";
  globalThis.fetch = async () => {
    upstreamCalls += 1;
    throw new Error("Offline Flowline evaluation cannot call upstream");
  };
  t.after(() => {
    if (previousTarget === undefined) delete process.env.MIRINAE_DEMO_TARGET;
    else process.env.MIRINAE_DEMO_TARGET = previousTarget;
    globalThis.fetch = originalFetch;
  });

  const state = createIndustryState(industry.demo);
  const actual = [];
  for (const [id, , , , , , authorVerdict, authorHandoff] of leadRows) {
    const response = await POST(new Request("https://public-demo.example.test/api/forwarding/assess", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ industry: industry.demo.id, leadId: id }),
    }));
    assert.equal(response.status, 200, id);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const { leadId, assessment } = await response.json() as { leadId: string; assessment: Assessment };
    assert.equal(leadId, id);
    assert.equal(assessment.mode, "saved", id);
    assert.equal(assessment.details?.sourceKind, "cache", id);
    assert.deepEqual(new Set(assessment.sources), new Set(industry.evidence[id]?.sources.map(({ url }) => url)), id);
    const expectedVerdict = authorVerdict.split("(")[0];
    const verdict = verdictLabels[assessment.verdict];
    const handoff = handoffLabel(assessment.handoff, state);
    actual.push({
      id, expectedVerdict, expectedHandoff: authorHandoff, verdict, handoff, reason: assessment.reason,
      domain: assessment.details?.domain, memoIntent: assessment.details?.memoIntent, evidence: assessment.details?.externalStatus,
    });
  }
  assert.equal(actual.length, 10);
  assert.equal(upstreamCalls, 0);
  const verdicts = actual.filter((row) => row.expectedVerdict === row.verdict).length;
  const handoffs = actual.filter((row) => row.expectedHandoff === row.handoff).length;
  const mismatches = actual.filter((row) => row.expectedVerdict !== row.verdict || row.expectedHandoff !== row.handoff);
  t.diagnostic("Flowline " + JSON.stringify({ verdicts, handoffs, both: actual.length - mismatches.length, total: actual.length, upstreamCalls }));
  for (const row of mismatches) t.diagnostic(JSON.stringify(row));
});
