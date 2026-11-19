import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import answers from "../src/lib/forwarding/evaluation/ground-truth.json";
import { forwardingPolicy } from "../src/lib/forwarding/policy";
import { createInitialForwardingState } from "../src/lib/forwarding/seed";
import { applyForwardingEvent, createBrowserForwardingStore, createForwardingStore, FORWARDING_STORAGE_KEY } from "../src/lib/forwarding/store";
import { VERDICTS, WORKFLOW_STATES } from "../src/lib/forwarding/types";
import type { ForwardingEvent } from "../src/lib/forwarding/types";
import type { StorageAdapter } from "../src/lib/forwarding/store";

class MemoryStorage implements StorageAdapter {
  values = new Map<string, string>();
  failRead = false;
  failWrite = false;
  failRemove = false;
  getItem(key: string) { if (this.failRead) throw new Error("blocked"); return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { if (this.failWrite) throw new Error("quota"); this.values.set(key, value); }
  removeItem(key: string) { if (this.failRemove) throw new Error("blocked"); this.values.delete(key); }
}
const at = "2026-11-18T10:00:00.000Z";
const decision = (id = "decision-1"): ForwardingEvent => ({ id, type: "decision", leadId: "L01", at, action: "approve", dealerId: "dealer-a", reason: "demo approval" });
const assessment: ForwardingEvent = { id: "assessment-1", type: "assessed", leadId: "L01", at, workflow: "decision-pending", assessment: { verdict: "valid", reason: "demo evidence", sources: ["https://www.snuh.org/"], searchedAt: at, mode: "saved" } };
const source = readFileSync(path.join(process.cwd(), "tests/fixtures/forwarding-source.md"), "utf8");
const sourceRows = source.split("\n").filter((line) => /^\| L\d\d \|/.test(line)).map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()));

test("all 30 operational inputs match the pinned author table, with L06 received last", () => {
  const state = createInitialForwardingState();
  assert.equal(sourceRows.length, 30);
  assert.equal(state.leads.length, 30);
  assert.equal(state.leads.at(-1)?.id, "L06");
  assert.equal(new Set(state.leads.map((lead) => lead.country)).size, 13);
  state.leads.forEach((lead, index) => {
    const row = sourceRows[index];
    assert.deepEqual([lead.id, lead.institution, lead.email, lead.country, lead.product, lead.memo], [row[0], row[1] === "(빈칸)" ? "" : row[1], row[3], row[4].replace(/\(.*\)$/, ""), row[5], row[6]]);
    assert.equal(lead.name, `Demo ${lead.id}`);
    assert.equal(lead.phone, `DEMO-NOT-A-PHONE-${lead.id}`);
    if (index) assert.ok(lead.receivedAt > state.leads[index - 1].receivedAt);
    assert.equal(state.leadStates[lead.id].assessment, null);
    assert.equal(state.leadStates[lead.id].workflow, "new");
  });
});

test("evaluation answers are complete and cannot be reached from runtime modules or inputs", () => {
  assert.equal(answers.length, 30);
  assert.equal(new Set(answers.map((row) => row.leadId)).size, 30);
  const counts = VERDICTS.map((verdict) => answers.filter((answer) => answer.verdict === verdict).length);
  assert.deepEqual(counts, [8, 3, 3, 2, 14]);
  for (const answer of answers) assert.ok(VERDICTS.includes(answer.verdict as (typeof VERDICTS)[number]));
  const runtime = createInitialForwardingState();
  for (const lead of runtime.leads) assert.deepEqual(Object.keys(lead).sort(), ["id", "name", "email", "phone", "institution", "country", "product", "memo", "receivedAt"].sort());
  for (const name of readdirSync(path.join(process.cwd(), "src/lib/forwarding"))) {
    if (!name.endsWith(".ts")) continue;
    const code = readFileSync(path.join(process.cwd(), "src/lib/forwarding", name), "utf8");
    assert.doesNotMatch(code, /(?:from\s*|import\s*\(|require\s*\()\s*["'][^"']*(?:evaluation|ground-truth)/);
  }
  assert.equal(runtime.events.length, 0);
  assert.equal(Object.values(runtime.leadStates).filter((lead) => lead.assessment !== null).length, 0);
});

test("seven dealers and 41 dated deliveries match the source with the scene 6 adjustment", () => {
  const state = createInitialForwardingState();
  assert.equal(state.dealers.length, 7);
  assert.equal(state.deliveries.length, 41);
  const rows = source.split("\n").filter((line) => /^\| (A Medical|D Medi|J Medica|U Health Supply|V MedSource|E Medtech GmbH|S Medical Pte) \|/.test(line)).map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()));
  for (const row of rows) {
    const dealer = state.dealers.find((candidate) => candidate.name === row[0]);
    assert.ok(dealer);
    assert.deepEqual(dealer.countries, [row[1]]);
    assert.equal(dealer.active, true);
    const deliveries = state.deliveries.filter((delivery) => delivery.dealerId === dealer.id);
    const expected = row.slice(2, 7).map(Number);
    if (dealer.id === "dealer-v") {
      // Scene 6 moves one existing deal to no-deal while retaining all seven deliveries.
      expected[1] -= 1;
      expected[2] += 1;
    }
    assert.deepEqual([deliveries.length, ...["deal", "no-deal", "in-progress", "no-response"].map((outcome) => deliveries.filter((delivery) => delivery.outcome === outcome).length)], expected);
  }
  const institutions = new Set(state.leads.map((lead) => lead.institution));
  assert.equal(new Set(state.deliveries.map((row) => row.id)).size, 41);
  for (const row of state.deliveries) {
    assert.ok(row.forwardedAt >= "2026-08-20T00:00:00.000Z" && row.forwardedAt <= "2026-11-17T23:59:59.999Z");
    assert.ok(!institutions.has(row.institution));
    assert.match(row.institution, /^Synthetic Historical Institution /);
  }
  assert.deepEqual(state.priorRelationships.map((row) => row.dealerId), ["dealer-a", "dealer-d"]);
});

test("the single policy holds configurable defaults, five regions and source-backed alias pairs", () => {
  assert.equal(forwardingPolicy.aggregationDays, 90);
  assert.equal(forwardingPolicy.minimumForwardedCount, 3);
  assert.equal(forwardingPolicy.responseBusinessDays, 1);
  assert.deepEqual(forwardingPolicy.weights, { noResponse: -0.1, priorRelationship: 0.1 });
  assert.equal(forwardingPolicy.managers.length, 5);
  assert.equal(Object.hasOwn(forwardingPolicy.countryRegions, "카자흐스탄"), false);
  assert.equal(forwardingPolicy.countryRegions.대한민국, "APAC");
  assert.equal(forwardingPolicy.countryRegions.일본, "APAC");
  assert.equal(forwardingPolicy.countryRegions.영국, "EU");
  assert.deepEqual(forwardingPolicy.institutionDomainAliases.map((row) => row.emailDomain).sort(), ["ccf.org", "mh.org.au", "gstt.nhs.uk", "mail.toyota.co.jp", "yuhs.ac"].sort());
  for (const alias of forwardingPolicy.institutionDomainAliases) assert.equal(new URL(alias.source).protocol, "https:");
  assert.equal(VERDICTS.length, 5);
  assert.equal(WORKFLOW_STATES.length, 8);
});

test("decision, result, reply and mail events survive refresh and identical IDs apply only once", () => {
  const storage = new MemoryStorage();
  const store = createForwardingStore(storage);
  assert.equal(store.append(assessment).ok, true);
  assert.equal(store.append({ id: "reply-1", type: "reply", leadId: "L01", at, kind: "country", text: "대한민국" }).ok, true);
  const approved = decision();
  assert.equal(store.append(approved).ok, true);
  const reordered = { reason: "demo approval", dealerId: "dealer-a", action: "approve", at, leadId: "L01", type: "decision", id: "decision-1" };
  assert.equal(store.append(reordered).duplicate, true);
  assert.equal(store.append({ id: "result-1", type: "dealer-result", leadId: "L01", at, dealerId: "dealer-a", deliveryId: "delivery:decision-1", outcome: "deal" }).ok, true);
  assert.equal(store.append({ id: "mail-1", type: "mail-delivery", leadId: "L01", at, mailId: "message-1", kind: "dealer-summary", recipientKind: "dealer", status: "unknown" }).ok, true);
  assert.equal(store.snapshot().events.length, 5);
  assert.equal(store.snapshot().deliveries.length, 42);
  assert.equal(store.snapshot().leadStates.L01.workflow, "connected");
  const reopened = createForwardingStore(storage);
  assert.deepEqual(reopened.hydrate().state, store.snapshot());
  assert.equal(reopened.snapshot().events.at(-1)?.type, "mail-delivery");
  const third = createForwardingStore(storage);
  assert.equal(third.append({ id: "reply-2", type: "reply", leadId: "L02", at, kind: "partnership", text: "demo reply" }).ok, true);
  assert.equal(third.snapshot().events.length, 6, "append without explicit hydrate preserves existing history");
});

test("reassessment and replies preserve approved assignments; caller mutations cannot contaminate snapshots", () => {
  const storage = new MemoryStorage();
  const store = createForwardingStore(storage);
  const event = decision();
  const saved = store.append(event);
  assert.equal(saved.ok, true);
  if (event.type === "decision") event.reason = "mutated caller";
  saved.state.leads[0].name = "mutated output";
  saved.state.events.length = 0;
  store.append(assessment);
  store.append({ id: "reply-1", type: "reply", leadId: "L01", at, kind: "manager-confirmation", text: "confirmed" });
  assert.equal(store.snapshot().leadStates.L01.workflow, "dealer-assigned");
  assert.equal(store.snapshot().leadStates.L01.dealerId, "dealer-a");
  assert.equal(store.snapshot().leads[0].name, "Demo L01");
  assert.equal(store.snapshot().events.length, 3);
  assert.equal(createInitialForwardingState().deliveries.length, 41);
});

test("invalid IDs, timestamps, references, oracle fields and unknown event payloads are rejected", () => {
  const state = createInitialForwardingState();
  const bad = [
    { ...decision(), leadId: "L99" }, { ...decision(), dealerId: "missing" },
    { ...decision(), id: "" }, { ...decision(), at: "2026-02-30T00:00:00.000Z" },
    { ...decision(), expectedVerdict: "valid" }, { ...decision(), type: "other" },
    { ...decision(), reason: "x".repeat(4001) },
    { ...assessment, assessment: { ...assessment.assessment, sources: ["javascript:alert(1)"] } },
    { ...assessment, assessment: { ...assessment.assessment, expectedDealer: "dealer-a" } },
    { id: "bad-result", type: "dealer-result", leadId: "L01", at, dealerId: "dealer-a", deliveryId: "missing", outcome: "deal" },
  ];
  for (const event of bad) assert.equal(applyForwardingEvent(state, event).error, "invalid-event");
  const store = createForwardingStore(new MemoryStorage());
  store.append(decision());
  assert.equal(store.append({ ...decision(), reason: "conflicting same ID" }).error, "invalid-event");
  assert.equal(store.snapshot().events.length, 1);
});

test("corrupt or unsupported saved data is not overwritten until explicit reset", () => {
  for (const raw of ["{", JSON.stringify({ version: 2, events: [] }), JSON.stringify({ version: 1, events: [decision(), { ...decision(), reason: "conflict" }] }), JSON.stringify({ version: 1, events: [], expected: true })]) {
    const storage = new MemoryStorage();
    storage.setItem(FORWARDING_STORAGE_KEY, raw);
    storage.setItem("another-app", "preserve");
    const store = createForwardingStore(storage);
    assert.equal(store.hydrate().error, "invalid-saved-data");
    assert.equal(store.append(decision()).error, "invalid-saved-data");
    assert.equal(storage.getItem(FORWARDING_STORAGE_KEY), raw);
    assert.equal(store.reset().ok, true);
    assert.equal(storage.getItem("another-app"), "preserve");
    assert.equal(store.snapshot().events.length, 0);
    assert.equal(store.snapshot().leads.at(-1)?.id, "L06");
    assert.equal(store.append(decision()).ok, true);
  }
});

test("storage read, quota and reset errors never throw or partially apply an event", () => {
  const storage = new MemoryStorage();
  const store = createForwardingStore(storage);
  storage.failRead = true;
  assert.equal(store.append(decision()).error, "storage-read-failed");
  storage.failRead = false;
  storage.failWrite = true;
  assert.equal(store.append(decision()).error, "storage-write-failed");
  assert.equal(store.snapshot().events.length, 0);
  storage.failWrite = false;
  assert.equal(store.append(decision()).ok, true);
  storage.failRemove = true;
  assert.equal(store.reset().error, "storage-write-failed");
  assert.equal(store.snapshot().events.length, 1);
  assert.equal(createForwardingStore(null).append(decision()).error, "storage-unavailable");
  assert.equal(createBrowserForwardingStore().hydrate().error, "storage-unavailable");
});

test("detached callbacks work and a failed reload revokes permission to overwrite saved data", () => {
  const storage = new MemoryStorage();
  const { append, hydrate, snapshot, reset } = createForwardingStore(storage);
  assert.equal(append(decision()).ok, true);
  assert.equal(hydrate().ok, true);
  storage.setItem(FORWARDING_STORAGE_KEY, "{corrupted later");
  assert.equal(hydrate().error, "invalid-saved-data");
  assert.equal(append(decision("decision-2")).error, "invalid-saved-data");
  assert.equal(storage.getItem(FORWARDING_STORAGE_KEY), "{corrupted later");
  assert.equal(snapshot().events.length, 1, "the last valid in-memory snapshot remains available");
  assert.equal(reset().ok, true);
  assert.equal(append(decision("decision-2")).ok, true);
});

test("historical outcome updates target the exact known delivery and replay in insertion order", () => {
  const storage = new MemoryStorage();
  const store = createForwardingStore(storage);
  const historical = store.snapshot().deliveries[0];
  assert.equal(store.append({ id: "history-result", type: "dealer-result", leadId: historical.leadId, at, deliveryId: historical.id, dealerId: historical.dealerId, outcome: "no-response" }).ok, true);
  assert.equal(store.append({ id: "later-result", type: "dealer-result", leadId: historical.leadId, at: "2026-11-18T09:00:00.000Z", deliveryId: historical.id, dealerId: historical.dealerId, outcome: "no-deal" }).ok, true);
  const loaded = createForwardingStore(storage).hydrate();
  assert.equal(loaded.ok, true);
  assert.equal(loaded.state.deliveries[0].outcome, "no-deal");
  assert.deepEqual(loaded.state.events.map((event) => event.id), ["history-result", "later-result"]);
});
