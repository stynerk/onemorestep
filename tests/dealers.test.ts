import assert from "node:assert/strict";
import test from "node:test";
import { recommendDealer, recordDealerOutcome } from "../src/lib/forwarding/dealers";
import { createInitialForwardingState } from "../src/lib/forwarding/seed";
import { createForwardingStore } from "../src/lib/forwarding/store";
import type { DealerDelivery, ForwardingEvent } from "../src/lib/forwarding/types";

const at = "2026-11-18T10:00:00.000Z";

function assessed(leadId: string): ForwardingEvent {
  return {
    id: `assessed:${leadId}`, type: "assessed", leadId, at, workflow: "decision-pending",
    assessment: { verdict: "valid", reason: "test assessment", sources: [], searchedAt: at, mode: "saved" },
  };
}

function createStore() {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
  return { storage, store: createForwardingStore(storage) };
}

test("demo dealer recommendations match all six named dealers and both manager routes", () => {
  const { store } = createStore();
  const expected = {
    L01: "A Medical", L05: "A Medical", L03: "V MedSource",
    L02: "J Medica", L11: "J Medica", L04: "E Medtech GmbH",
  };
  for (const leadId of [...Object.keys(expected), "L06", "L07"]) assert.equal(store.append(assessed(leadId)).ok, true);
  const snapshot = store.snapshot();
  for (const [leadId, name] of Object.entries(expected)) {
    const recommendation = recommendDealer(snapshot, leadId);
    assert.equal(recommendation?.route, "dealer", leadId);
    assert.equal(recommendation.ranked[0].dealer.name, name, leadId);
  }
  const korean = recommendDealer(snapshot, "L01");
  assert.equal(korean?.route, "dealer");
  assert.deepEqual(korean.ranked.map((row) => [row.dealer.name, row.forwarded, row.deals, row.closed, row.inProgress, row.noResponse, row.priorRelationship]), [
    ["A Medical", 8, 3, 7, 1, 0, true], ["D Medi", 6, 1, 3, 0, 3, false],
  ]);
  assert.equal(korean.ranked[0].conversionRate, 3 / 7);
  assert.equal(korean.ranked[0].relationshipBonus, 0.1);
  assert.ok(Math.abs(korean.ranked[0].score - (3 / 7 + 0.1)) < 1e-12);
  assert.ok(Math.abs(korean.ranked[1].noResponsePenalty + 0.3) < 1e-12);

  const newDealer = recommendDealer(snapshot, "L06");
  assert.equal(newDealer?.route, "manager-confirmation");
  assert.equal(newDealer.manager.id, "manager-apac");
  assert.deepEqual(newDealer.candidates.map((row) => [row.dealer.name, row.forwarded, row.lowHistory, row.score]), [
    ["S Medical Pte", 2, true, null],
  ]);
  const managerDirect = recommendDealer(snapshot, "L07");
  assert.equal(managerDirect?.route, "manager-direct");
  assert.equal(managerDirect.manager.id, "manager-apac");
  assert.deepEqual(recommendDealer(snapshot, "L15"), { route: "operations", country: "카자흐스탄" });
  assert.deepEqual(recommendDealer(snapshot, "L08"), { route: "not-eligible" });
  assert.equal(recommendDealer(snapshot, "unknown"), null);
});

test("country, active status, product, fixed date window, and unresolved conversion filter the rank", () => {
  const { store } = createStore();
  store.append(assessed("L01"));
  const state = store.snapshot();
  const first = state.dealers.find((dealer) => dealer.id === "dealer-a")!;
  const second = state.dealers.find((dealer) => dealer.id === "dealer-d")!;
  first.active = false;
  assert.equal(recommendDealer(state, "L01")?.route, "dealer");
  second.products = ["IS-3"];
  assert.equal(recommendDealer(state, "L01")?.route, "manager-direct");
  const corrected = recommendDealer(state, "L01", { country: "일본" });
  assert.equal(corrected?.route, "dealer");
  assert.equal(corrected.ranked[0].dealer.id, "dealer-j");

  first.active = true;
  state.priorRelationships = [];
  const delivery = state.deliveries[0];
  const row = (id: string, forwardedAt: string, outcome: DealerDelivery["outcome"], institution = delivery.institution): DealerDelivery => ({
    ...delivery, id, forwardedAt, outcome, institution,
  });
  state.deliveries = [
    row("expired", "2026-08-19T23:59:59.999Z", "deal", state.leads.find((lead) => lead.id === "L01")!.institution),
    row("first", "2026-08-20T00:00:00.000Z", "in-progress"),
    row("middle", "2026-11-01T00:00:00.000Z", "no-response"),
    row("last", "2026-11-18T00:00:00.000Z", "in-progress"),
    row("future", "2026-11-18T00:00:00.001Z", "deal"),
  ];
  const recommendation = recommendDealer(state, "L01", { asOf: new Date("2026-11-18T00:00:00.000Z") });
  assert.equal(recommendation?.route, "manager-confirmation");
  const [candidate] = recommendation.candidates;
  assert.deepEqual([candidate.forwarded, candidate.closed, candidate.inProgress, candidate.noResponse], [3, 0, 2, 1]);
  assert.deepEqual(candidate.deliveries.map(({ id }) => id), ["first", "middle", "last"]);
  assert.equal(candidate.lowHistory, false);
  assert.equal(candidate.conversionRate, null);
  assert.equal(candidate.score, null);
  assert.equal(candidate.priorRelationship, true);
});

test("equal scores sort by deal count then dealer name", () => {
  const { store } = createStore();
  store.append(assessed("L03"));
  const state = store.snapshot();
  const dealer = state.dealers.find((row) => row.id === "dealer-u")!;
  state.dealers.push({ ...dealer, id: "dealer-b", name: "B Supply" }, { ...dealer, id: "dealer-z", name: "Z Supply" });
  const makeRows = (dealerId: string, dealCount: number) => Array.from({ length: dealCount * 2 }, (_, index): DealerDelivery => ({
    id: `${dealerId}:${index}`, dealerId, leadId: `historical:${index}`, institution: "Synthetic institution",
    forwardedAt: at, outcome: index < dealCount ? "deal" : "no-deal",
  }));
  state.deliveries = [...makeRows("dealer-u", 2), ...makeRows("dealer-v", 3), ...makeRows("dealer-b", 3), ...makeRows("dealer-z", 2)];
  const recommendation = recommendDealer(state, "L03");
  assert.equal(recommendation?.route, "dealer");
  assert.deepEqual(recommendation.ranked.map(({ dealer, score }) => [dealer.id, score]), [
    ["dealer-b", 0.5], ["dealer-v", 0.5], ["dealer-u", 0.5], ["dealer-z", 0.5],
  ]);
});

test("one scene 6 no-response swaps pending recommendations and preserves approved allocations", () => {
  const { storage, store } = createStore();
  const base = createInitialForwardingState();
  const inProgress = base.deliveries.find((row) => row.dealerId === "dealer-v" && row.outcome === "in-progress")!;
  assert.equal(inProgress.id, "delivery-034");
  assert.equal(store.append(assessed("L03")).ok, true);
  assert.equal(store.append({ id: "approval", type: "decision", leadId: "L01", at, action: "approve", dealerId: "dealer-a", reason: "test approval" }).ok, true);
  const score = () => {
    const result = recommendDealer(store.snapshot(), "L03");
    assert.equal(result?.route, "dealer");
    return result;
  };
  const order = () => score().ranked.map(({ dealer, score }) => [dealer.id, score]);
  assert.deepEqual(order(), [["dealer-v", 0.333333333333], ["dealer-u", 0.3]]);
  const noResponse = { id: "result-pending", at, delivery: inProgress, outcome: "no-response" } as const;
  assert.equal(recordDealerOutcome(store, noResponse).ok, true);
  assert.deepEqual(order(), [["dealer-u", 0.3], ["dealer-v", 0.233333333333]]);
  assert.equal(store.snapshot().events.filter(({ type }) => type === "dealer-result").length, 1);
  assert.equal(recordDealerOutcome(store, noResponse).duplicate, true);

  const delivered = store.snapshot().deliveries.find(({ id }) => id === "delivery:approval")!;
  assert.equal(recordDealerOutcome(store, { id: "result-approved", at, delivery: delivered, outcome: "deal" }).ok, true);
  assert.equal(recordDealerOutcome(store, { id: "result-corrected", at, delivery: delivered, outcome: "no-deal" }).ok, true);
  assert.deepEqual(recommendDealer(store.snapshot(), "L01"), { route: "assigned", dealerId: "dealer-a" });
  const reopened = createForwardingStore(storage).hydrate();
  assert.equal(reopened.ok, true);
  assert.deepEqual(reopened.state, store.snapshot());
  assert.equal(reopened.state.deliveries.find(({ id }) => id === delivered.id)?.outcome, "no-deal");
  assert.equal(reopened.state.events.filter(({ type }) => type === "dealer-result").length, 3);
});

test("new deliveries after the policy reference date join the normal 90-day window", () => {
  const { store } = createStore();
  store.append(assessed("L01"));
  store.append({ id: "later-approval", type: "decision", leadId: "L05", at, action: "approve", dealerId: "dealer-a", reason: "test approval" });
  const recommendation = recommendDealer(store.snapshot(), "L01");
  assert.equal(recommendation?.route, "dealer");
  assert.equal(recommendation.window.from, "2026-08-20T00:00:00.000Z");
  assert.equal(recommendation.window.through, at);
  assert.equal(recommendation.ranked[0].dealer.id, "dealer-a");
  assert.equal(recommendation.ranked[0].forwarded, 9);
  assert.equal(recommendation.ranked[0].inProgress, 2);
});
