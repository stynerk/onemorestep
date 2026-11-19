import assert from "node:assert/strict";
import { test } from "node:test";
import { dealerScore, recommendDealer } from "../src/lib/forwarding/dealers";
import { confirmedManagerDealer, mailKindFor, mailRequestsFor, nextBusinessDate } from "../src/lib/forwarding/inbox";
import { currentDelivery, reassignmentProposal, reassignmentTarget, responseClock } from "../src/lib/forwarding/reassignment";
import { applyForwardingEvent, createForwardingStore, isForwardingEvent } from "../src/lib/forwarding/store";
import { createInitialForwardingState } from "../src/lib/forwarding/seed";
import type { ForwardingEvent, ForwardingState } from "../src/lib/forwarding/types";

const friday = "2026-11-19T17:15:30.125Z"; // Friday 02:15 KST, still Thursday in UTC.
const monday = "2026-11-22T17:15:30.125Z";
const approved = (leadId: string, dealerId: string): ForwardingEvent => ({
  id: `approve:${leadId}`, leadId, at: friday, type: "decision", action: "approve", dealerId, reason: "시연 승인",
});
const assessed = (leadId: string): ForwardingEvent => ({
  id: `assessed:${leadId}`, leadId, at: friday, type: "assessed", workflow: "decision-pending",
  assessment: { verdict: "valid", reason: "시연 판정", sources: [], searchedAt: friday, mode: "saved" },
});

function memory() {
  let value: string | null = null;
  return { getItem: () => value, setItem: (_key: string, stored: string) => { value = stored; }, removeItem: () => { value = null; } };
}

function leadById(state: ForwardingState, leadId: string) {
  return state.leads.find((lead) => lead.id === leadId)!;
}

function acceptProposal(state: ForwardingState, leadId: string, at = monday): Extract<ForwardingEvent, { type: "reassigned" }> {
  const proposal = reassignmentProposal(state, leadById(state, leadId), Date.parse(at));
  assert.ok(proposal);
  return { type: "reassigned", id: `reassign:${proposal.delivery.id}`, previousDeliveryId: proposal.delivery.id, at, leadId,
    ...reassignmentTarget(proposal) };
}

test("dealer deadlines preserve Seoul time across weekends, even when the UTC date differs", () => {
  assert.equal(nextBusinessDate(friday), monday);
  // Saturday 01:00 KST must use the Monday wall-clock time, despite Friday in UTC.
  assert.equal(nextBusinessDate("2026-11-20T16:00:00.000Z"), "2026-11-22T16:00:00.000Z");
  assert.equal(nextBusinessDate(friday, 2), "2026-11-23T17:15:30.125Z");
});

test("one approval at the exact deadline atomically switches dealers and persists the old penalty", () => {
  const storage = memory();
  const store = createForwardingStore(storage);
  assert.equal(store.append(assessed("L03")).ok, true);
  const first = approved("L03", "dealer-v");
  assert.equal(store.append(first).ok, true);
  const original = store.snapshot();
  const lead = leadById(original, "L03");
  const expiry = Date.parse(monday);
  assert.equal(reassignmentProposal(original, lead, expiry - 1), null);
  const event = acceptProposal(original, lead.id);
  assert.deepEqual({ target: event.target, dealerId: event.dealerId }, { target: "dealer", dealerId: "dealer-u" });
  assert.equal(mailKindFor(event), "dealer-summary");
  assert.equal(isForwardingEvent(event, createInitialForwardingState()), true);
  assert.equal(store.append({ ...event, at: new Date(expiry - 1).toISOString() }).ok, false);
  assert.equal(store.append({ ...event, dealerId: "dealer-v" }).ok, false);
  assert.equal(store.append(event).ok, true);
  assert.equal(store.append(event).duplicate, true);
  assert.equal(store.append({ ...event, id: "duplicate-with-new-id" }).ok, false);
  assert.equal(store.append({
    id: "stale-result", type: "dealer-result", deliveryId: event.previousDeliveryId, dealerId: "dealer-v",
    leadId: lead.id, at: monday, outcome: "deal",
  }).ok, false);
  const reloaded = createForwardingStore(storage).hydrate();
  assert.equal(reloaded.ok, true);
  assert.deepEqual(reloaded.state, store.snapshot());
  const { state } = reloaded;
  assert.equal(state.events.filter((item) => item.type === "reassigned").length, 1);
  const attempts = state.deliveries.filter((row) => row.leadId === lead.id);
  assert.deepEqual(attempts.map(({ dealerId, outcome }) => [dealerId, outcome]), [
    ["dealer-v", "no-response"], ["dealer-u", "in-progress"],
  ]);
  assert.equal(currentDelivery(state, lead.id)?.forwardedAt, monday);
  assert.equal(responseClock(state, Date.parse(friday), null), expiry);
  assert.deepEqual(recommendDealer(state, lead.id), { route: "assigned", dealerId: "dealer-u" });
  const originalDealer = state.dealers.find((dealer) => dealer.id === "dealer-v")!;
  assert.ok(Math.abs(dealerScore(state, lead, originalDealer).score! - (dealerScore(original, lead, originalDealer).score! - 0.1)) < 1e-12);

  const fallback = acceptProposal(state, lead.id, nextBusinessDate(monday));
  assert.equal(fallback.target, "manager-direct");
  assert.equal(mailKindFor(fallback), null);
  const routed = applyForwardingEvent(state, fallback);
  assert.equal(routed.ok, true);
  assert.equal(routed.state.leadStates[lead.id].workflow, "manager-direct-pending");
  assert.equal(routed.state.leadStates[lead.id].dealerId, null);
  assert.equal(routed.state.deliveries.filter((row) => row.leadId === lead.id).length, 2);
  assert.equal(recommendDealer(routed.state, lead.id)?.route, "manager-direct");
});

test("a closed response invalidates an open card while a recorded no-response still allows reassignment", () => {
  const store = createForwardingStore(memory());
  assert.equal(store.append(assessed("L03")).ok, true);
  assert.equal(store.append(approved("L03", "dealer-v")).ok, true);
  const original = store.snapshot();
  const event = acceptProposal(original, "L03");
  for (const outcome of ["deal", "no-deal", "no-response"] as const) {
    const result = applyForwardingEvent(original, {
      id: "late-outcome", type: "dealer-result", deliveryId: event.previousDeliveryId, dealerId: "dealer-v",
      leadId: "L03", at: monday, outcome,
    });
    assert.equal(result.ok, true);
    const pending = reassignmentProposal(result.state, leadById(result.state, "L03"), Date.parse(monday));
    assert.equal(Boolean(pending), outcome === "no-response");
    assert.equal(applyForwardingEvent(result.state, event).ok, outcome === "no-response");
  }
});

test("only low-history alternatives require a fresh manager confirmation and no automatic dealer mail", () => {
  const store = createForwardingStore(memory());
  assert.equal(store.append(assessed("L06")).ok, true);
  assert.equal(store.append({
    type: "reply", id: "previous-manager-reply", at: friday, leadId: "L06",
    kind: "manager-confirmation", selection: "dealer-s", text: "시연 확인",
  }).ok, true);
  assert.equal(store.append(approved("L06", "dealer-s")).ok, true);
  const state = store.snapshot();
  const previous = state.dealers.find((dealer) => dealer.id === "dealer-s")!;
  state.dealers = [...state.dealers, { ...previous, id: "new-sg", name: "새 가상 딜러" }];
  const event = acceptProposal(state, "L06");
  assert.equal(event.target, "manager-confirmation");
  assert.equal(mailKindFor(event), "manager-confirmation");
  const saved = applyForwardingEvent(state, event);
  assert.equal(saved.ok, true);
  assert.equal(saved.state.leadStates.L06.workflow, "manager-confirmation-pending");
  assert.equal(saved.state.leadStates.L06.dealerId, null);
  assert.equal(confirmedManagerDealer(saved.state, "L06"), undefined);
  const candidate = recommendDealer(saved.state, "L06");
  assert.equal(candidate?.route, "manager-confirmation");
  assert.deepEqual(candidate.candidates.map((row) => row.dealer.id), ["new-sg"]);
  assert.equal(currentDelivery(saved.state, "L06"), undefined);
  const reply = applyForwardingEvent(saved.state, {
    type: "reply", id: "new-manager-reply", at: monday, leadId: "L06",
    kind: "manager-confirmation", selection: "new-sg", text: "시연 확인",
  });
  assert.equal(reply.ok, true);
  assert.equal(confirmedManagerDealer(reply.state, "L06"), "new-sg");
});

test("legacy and reassignment summaries for the same lead keep independent delivery and retry records", () => {
  const store = createForwardingStore(memory());
  assert.equal(store.append(assessed("L03")).ok, true);
  const first = approved("L03", "dealer-v");
  assert.equal(store.append(first).ok, true);
  const legacy: ForwardingEvent = {
    id: "original-mail", type: "mail-delivery", mailId: "original-id", at: friday, leadId: "L03",
    recipientKind: "dealer", status: "sent", kind: "dealer-summary",
  };
  assert.equal(store.append(legacy).ok, true);
  const event = acceptProposal(store.snapshot(), "L03");
  assert.equal(store.append(event).ok, true);
  const replacement: ForwardingEvent = {
    ...legacy, id: "replacement-mail", mailId: "replacement-id", status: "failed", causeEventId: event.id,
  };
  assert.equal(store.append({ ...replacement, kind: "country-check" }).ok, false);
  assert.equal(store.append(replacement).ok, true);
  const state = store.snapshot();
  assert.deepEqual(mailRequestsFor(state.events, leadById(state, "L03")).map(({ event: source, delivery }) =>
    [source.id, delivery?.id, delivery?.status]), [[first.id, legacy.id, "sent"], [event.id, replacement.id, "failed"]]);
});
