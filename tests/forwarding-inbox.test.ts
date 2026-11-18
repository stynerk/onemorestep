import assert from "node:assert/strict";
import { test } from "node:test";
import { POST as sendMail } from "../src/app/api/forwarding/mail/route";
import { POST as assess } from "../src/app/api/forwarding/assess/route";
import { confirmedCountry, inboxBucket, inboxOrder, mailKindFor, maskEmail, maskPhone, nextBusinessDate } from "../src/lib/forwarding/inbox";
import { createInitialForwardingState } from "../src/lib/forwarding/seed";
import { createForwardingStore } from "../src/lib/forwarding/store";
import type { ForwardingEvent } from "../src/lib/forwarding/types";

const at = "2026-11-20T09:00:00.000Z";
const verdict = (leadId: string, value: "valid" | "invalid"): ForwardingEvent => ({
  type: "assessed", id: `assessment:${leadId}`, leadId, at, workflow: "decision-pending",
  assessment: { verdict: value, mode: "saved", reason: "가상 확인", sources: [], searchedAt: at },
});

function memory() {
  let value: string | null = null;
  return { getItem: () => value, setItem: (_key: string, stored: string) => { value = stored; }, removeItem: () => { value = null; } };
}

test("the newest inquiry is initially last and the valid L06 is promoted to the first row", () => {
  const { leads } = createInitialForwardingState();
  assert.equal(inboxOrder(leads, null).at(-1)?.id, "L06");
  const store = createForwardingStore(memory());
  store.append(verdict("L01", "valid"));
  const state = store.append(verdict("L06", "valid")).state;
  const valid = leads.filter((lead) => inboxBucket(state, lead) === "valid");
  assert.deepEqual(inboxOrder(valid, "valid").map((lead) => lead.id), ["L06", "L01"]);
});

test("invalid rows can be reopened and country replies survive hydration without altering old event formats", () => {
  const storage = memory();
  const store = createForwardingStore(storage);
  store.append(verdict("L18", "invalid"));
  store.append({ type: "decision", id: "bulk", at, leadId: "L18", action: "disqualify", dealerId: null, reason: "일괄" });
  const reopen: ForwardingEvent = { type: "review-reopened", id: "reopen", leadId: "L18", at };
  assert.equal(store.append(reopen).ok, true);
  assert.equal(store.append(reopen).duplicate, true);
  assert.equal(store.append({ ...reopen, id: "invalid-reopen" }).ok, false);
  assert.equal(store.append({ type: "reply", id: "country", at, leadId: "L12", kind: "country", text: "독일 확인", selection: "독일" }).ok, true);
  assert.equal(store.append({ type: "reply", id: "altered", at, leadId: "L12", kind: "country", text: "가상", selection: "없음" }).ok, false);
  const restored = createForwardingStore(storage).hydrate();
  assert.equal(restored.ok, true);
  assert.equal(restored.state.leadStates.L18.assessment?.verdict, "ambiguous");
  assert.equal(confirmedCountry(restored.state, "L12"), "독일");
});

test("forwarding mail accepts a matching business event and rejects cross-origin or injected recipients before dispatch", async () => {
  const decision: ForwardingEvent = { type: "decision", id: "approval", at, leadId: "L01", action: "approve", dealerId: "k-medi", reason: "승인" };
  assert.equal(mailKindFor(decision), "dealer-summary");
  const post = (origin: string, body: object) => sendMail(new Request("http://127.0.0.1/api/forwarding/mail", {
    method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body),
  }));
  assert.equal((await post("https://example.test", { event: decision })).status, 403);
  assert.equal((await post("http://127.0.0.1", { event: decision, to: "recipient@example.test" })).status, 400);
  assert.equal((await post("http://127.0.0.1", { event: { ...decision, bcc: ["recipient@example.test"] } })).status, 400);
});

test("the partnership reassessment accepts only a structured signal, and the displayed contacts are masked", async () => {
  const post = (body: object) => assess(new Request("http://localhost/api/forwarding/assess", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  }));
  assert.equal((await post({ leadId: "L22", partnershipPurchase: "custom note" })).status, 400);
  assert.equal((await post({ leadId: "L22", memo: "custom note" })).status, 400);
  assert.equal(maskEmail("demo-part@example.test"), "de•••@example.test");
  assert.equal(maskPhone("DEMO-NOT-A-PHONE-L01"), "•••• -L01");
  assert.equal(nextBusinessDate(at), "2026-11-23T09:00:00.000Z");
});
