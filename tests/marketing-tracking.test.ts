import assert from "node:assert/strict";
import { test } from "node:test";
import { POST as assess } from "../src/app/api/forwarding/assess/route";
import { createForwardingStore, type StorageAdapter } from "../src/lib/forwarding/store";
import { campaignEffect, demoAcquisitionForLead, evaluationCampaignForLead } from "../src/lib/marketing/campaign-policy";
import { marketingCampaignMetrics, marketingLeadOptions } from "../src/lib/marketing/tracking";

function browserStorage(): StorageAdapter {
  const entries = new Map<string, string>();
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => { entries.set(key, value); },
    removeItem: (key) => { entries.delete(key); },
  };
}

test("campaign effects use the configured minimum, exact thresholds and pending state", () => {
  assert.equal(campaignEffect(0, 0), "판단 보류");
  assert.equal(campaignEffect(2, 2), "판단 보류");
  assert.equal(campaignEffect(6, 3, 1), "판정 전");
  assert.equal(campaignEffect(4, 2), "효과 높음");
  assert.equal(campaignEffect(5, 1), "보통");
  assert.equal(campaignEffect(6, 1), "효과 낮음");
});

test("demo attribution is separate from lead inputs and only E01 to E70 get frozen evaluation attribution", () => {
  const leads = createForwardingStore(null).snapshot().leads;
  assert.equal(leads.length, 30);
  assert.ok(leads.every(({ id }) => demoAcquisitionForLead(id)));
  assert.deepEqual(demoAcquisitionForLead("L06"), { code: "C1", label: "C1 LinkedIn" });
  assert.deepEqual(demoAcquisitionForLead("L07"), { code: "direct", label: "직접 유입" });
  assert.equal(demoAcquisitionForLead("I01"), undefined);
  assert.equal(evaluationCampaignForLead("N01"), null);
  assert.equal(evaluationCampaignForLead("E71"), null);
  const counts: Record<string, number> = {};
  for (let id = 1; id <= 70; id++) {
    const code = evaluationCampaignForLead("E" + String(id).padStart(2, "0"));
    assert.ok(code);
    counts[code] = (counts[code] ?? 0) + 1;
  }
  assert.deepEqual(counts, { C1: 14, C2: 14, C3: 14, C4: 14, direct: 14 });
});

test("marketing hydrates real saved inbox verdicts and counts persisted dealer assignments separately", async (t) => {
  const previousTarget = process.env.MIRINAE_DEMO_TARGET;
  const originalFetch = globalThis.fetch;
  t.after(() => {
    if (previousTarget === undefined) delete process.env.MIRINAE_DEMO_TARGET;
    else process.env.MIRINAE_DEMO_TARGET = previousTarget;
    globalThis.fetch = originalFetch;
  });
  let externalCalls = 0;
  process.env.MIRINAE_DEMO_TARGET = "public";
  globalThis.fetch = async () => {
    externalCalls += 1;
    throw new Error("A public verdict attempted an external request");
  };

  const storage = browserStorage();
  const inbox = createForwardingStore(storage);
  const initial = inbox.hydrate().state;
  assert.ok(marketingCampaignMetrics(initial).every((row) => row.effect === "판정 전" && row.validRatio === null));
  assert.equal(marketingLeadOptions(initial).find(({ id }) => id === "L03")?.stage, "없음");

  const at = "2026-11-24T09:00:00.000Z";
  for (const { id } of initial.leads) {
    const response = await assess(new Request("https://public-demo.example.test/api/forwarding/assess", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId: id }),
    }));
    assert.equal(response.status, 200, id);
    const { assessment, workflow } = await response.json();
    const result = inbox.append({ id: "assessment:" + id, leadId: id, type: "assessed", at, assessment, workflow });
    assert.equal(result.ok, true, id);
  }

  const tracked = createForwardingStore(storage).hydrate().state;
  assert.deepEqual(marketingCampaignMetrics(tracked).map(({ code, valid, total, effect, dealerCount }) =>
    [code, valid, total, effect, dealerCount]), [
    ["C1", 3, 5, "효과 높음", 0], ["C2", 0, 6, "효과 낮음", 0],
    ["C3", 2, 4, "효과 높음", 0], ["C4", 1, 3, "보통", 0],
  ]);
  assert.deepEqual(marketingLeadOptions(tracked).filter(({ id }) => id === "L03").map(({ region, stage }) => [region, stage]), [["NA", "문의"]]);

  const lead = tracked.leadStates.L03;
  const handoff = lead.assessment?.handoff;
  assert.equal(handoff?.kind, "dealer");
  if (handoff?.kind !== "dealer") throw new Error("Expected dealer handoff");
  const decision = inbox.append({ id: "tracking-approval", leadId: "L03", type: "decision", at, action: "approve", reason: "추천 딜러 승인", dealerId: handoff.dealerId });
  assert.equal(decision.ok, true);
  const assigned = createForwardingStore(storage).hydrate().state;
  assert.equal(marketingCampaignMetrics(assigned).find(({ code }) => code === "C3")?.dealerCount, 1);
  assert.equal(marketingLeadOptions(assigned).find(({ id }) => id === "L03")?.stage, "견적");
  assert.equal(externalCalls, 0);
});
