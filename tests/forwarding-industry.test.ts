import assert from "node:assert/strict";
import { test } from "node:test";
import { dealerScore, recommendDealer } from "../src/lib/forwarding/dealers";
import { responseDeadline } from "../src/lib/forwarding/inbox";
import { createIndustryState, industryHandoffForLead } from "../src/lib/forwarding/industry-demo";
import { assessSavedIndustryLead, type SavedIndustry } from "../src/lib/forwarding/industry-demo.server";
import { createForwardingStore, FORWARDING_STORAGE_KEY } from "../src/lib/forwarding/store";
import type { ForwardingEvent, LeadInput } from "../src/lib/forwarding/types";

const at = "2026-11-18T12:00:00.000Z";
const lead: LeadInput = {
  id: "L03", name: "Synthetic buyer", email: "buyer@hollobrook.org", phone: "",
  institution: "Hollobrook Analytics", country: "미국", product: "SaaS-Test-Enterprise",
  memo: "Requesting a purchase quote for our analytics team.", receivedAt: at,
};
const preview: SavedIndustry = {
  demo: {
    id: "b2b-saas", label: "Synthetic unit-test industry", brand: "Test Only", dealer: "파트너",
    seed: {
      leads: [lead],
      dealers: [
        { id: "partner-a", name: "Partner A", countries: ["미국"], products: [lead.product], active: true },
        { id: "partner-b", name: "Partner B", countries: ["미국"], products: [lead.product], active: true },
      ],
      deliveries: [
        { id: "hist-1", leadId: "old", dealerId: "partner-a", institution: "Synthetic past buyer", forwardedAt: "2026-10-01T12:00:00.000Z", outcome: "deal" },
        { id: "hist-2", leadId: "sample-1", dealerId: "partner-a", institution: "Synthetic past buyer", forwardedAt: at, outcome: "deal" },
        { id: "hist-3", leadId: "sample-2", dealerId: "partner-a", institution: "Synthetic past buyer", forwardedAt: at, outcome: "no-response" },
        { id: "hist-4", leadId: "sample-3", dealerId: "partner-b", institution: "Synthetic past buyer", forwardedAt: at, outcome: "deal" },
        { id: "hist-5", leadId: "sample-4", dealerId: "partner-b", institution: "Synthetic past buyer", forwardedAt: at, outcome: "no-deal" },
      ],
      priorRelationships: [{ dealerId: "partner-b", institution: lead.institution }],
      policy: {
        aggregationDays: 20, minimumForwardedCount: 1, responseBusinessDays: 2, responseTimeZone: "Asia/Seoul",
        weights: { noResponse: -0.25, priorRelationship: 0.4 }, referenceDate: at,
        countryRegions: { 미국: "EU" }, managers: [{ id: "synthetic-manager", name: "Synthetic manager", region: "EU" }],
      },
    },
  },
  evidence: {
    [lead.id]: { searchedAt: at, sources: [{
      title: lead.institution, url: "https://hollobrook.org/contact", description: "Headquarters address in Ohio, United States.",
    }] },
  },
};

test("the alternate industry assesses stored source evidence and ranks its own partners under its policy", () => {
  const outcome = assessSavedIndustryLead(preview, lead);
  assert.equal(outcome.assessment.verdict, "valid");
  assert.equal(outcome.assessment.mode, "saved");
  assert.equal(outcome.assessment.details?.sourceKind, "cache");
  assert.deepEqual(outcome.assessment.handoff, { kind: "dealer", dealerId: "partner-b" });
  assert.deepEqual(outcome.assessment.sources, ["https://hollobrook.org/contact"]);

  const state = createIndustryState(preview.demo);
  state.leadStates[lead.id].assessment = outcome.assessment;
  const recommendation = recommendDealer(state, lead.id);
  assert.equal(recommendation?.route, "dealer");
  if (recommendation?.route !== "dealer") throw new Error("Expected ranked partners");
  assert.equal(recommendation.manager.id, "synthetic-manager");
  assert.equal(recommendation.window.days, 20);
  assert.deepEqual(recommendation.ranked.map((row) => [row.dealer.id, row.score]), [["partner-b", 0.9], ["partner-a", 0.75]]);
  assert.equal(dealerScore(state, lead, state.dealers[0]).forwarded, 2);
  assert.deepEqual(industryHandoffForLead(state, lead), { kind: "dealer", dealerId: "partner-b" });
  assert.equal(responseDeadline(state, at), "2026-11-20T12:00:00.000Z");

  const suspicious = assessSavedIndustryLead(preview, { ...lead, email: "buyer@hollobrook-verify.org" });
  assert.equal(suspicious.assessment.verdict, "ambiguous");
  assert.equal(suspicious.assessment.details?.domain, "suspicious");
  assert.deepEqual(suspicious.assessment.handoff, { kind: "regional-sales", region: "EU" });
  state.leadStates[lead.id].assessment = suspicious.assessment;
  assert.deepEqual(industryHandoffForLead(state, lead), { kind: "regional-sales", region: "EU" });

  const missing = assessSavedIndustryLead({ ...preview, evidence: {} }, lead);
  assert.equal(missing.assessment.verdict, "ambiguous");
  assert.equal(missing.assessment.details?.externalStatus, "saved-unavailable");
});

test("alternate restore and reset isolate events even when a lead ID exists in both industries", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
  const original = createForwardingStore(storage);
  const alt = createForwardingStore(storage, preview.demo);
  const decision = (id: string): ForwardingEvent => {
    return { id, at, leadId: lead.id, type: "decision", action: "phone", dealerId: null, reason: "test" };
  };

  assert.equal(original.hydrate().state.leads.length, 30);
  assert.equal(alt.hydrate().state.leads[0].product, lead.product);
  assert.equal(original.append(decision("medicom-event")).ok, true);
  assert.equal(alt.append(decision("saas-event")).ok, true);
  assert.equal(values.has(FORWARDING_STORAGE_KEY), true);
  assert.equal(createForwardingStore(storage).hydrate().state.events[0].id, "medicom-event");
  const restored = createForwardingStore(storage, preview.demo);
  assert.equal(restored.hydrate().state.events[0].id, "saas-event");
  assert.equal(restored.reset().ok, true);
  assert.deepEqual(createForwardingStore(storage, preview.demo).hydrate().state.events, []);
  assert.equal(createForwardingStore(storage).hydrate().state.events[0].id, "medicom-event");
});
