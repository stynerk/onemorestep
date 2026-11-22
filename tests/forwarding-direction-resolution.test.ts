import assert from "node:assert/strict";
import test from "node:test";
import { createAssessmentService } from "../src/lib/forwarding/assessment-service";
import { getDirectionQuestion } from "../src/lib/forwarding/direction-questions";
import { applyDirectionConfirmation, DIRECTION_ACTOR, directionConfirmationFor } from "../src/lib/forwarding/direction-resolution";
import { getSavedIndustry, assessSavedIndustryLead } from "../src/lib/forwarding/industry-demo.server";
import { lookupSavedInquiryIntent } from "../src/lib/forwarding/intent-router";
import { savedInquiryIntents } from "../src/lib/forwarding/saved-inquiry-intents";
import { createInitialForwardingState } from "../src/lib/forwarding/seed";
import { applyForwardingEvent, createForwardingStore } from "../src/lib/forwarding/store";
import type { Assessment, DirectionAnswer, DirectionConfirmation, ForwardingEvent, LeadInput } from "../src/lib/forwarding/types";

const at = "2026-11-22T04:00:00.000Z";
const later = "2026-11-22T05:00:00.000Z";
const answer = (fields: DirectionAnswer): DirectionConfirmation => ({ ...fields, at, actor: DIRECTION_ACTOR, note: "담당자 확인 메모", previous: false });

const unresolved: Assessment = {
  verdict: "ambiguous", reason: "도메인 확인 필요", sources: ["https://www.hospital.example.org/about"], searchedAt: at, mode: "saved",
  details: { domain: "unverified", countries: ["미국"], industry: null, memoIntent: "buying", memoQuote: "Quote", externalStatus: "complete", sourceKind: "cache" },
  handoff: { kind: "regional-sales", region: "NA" },
  directionQuestion: { question: "질문", summary: "확인한 근거" },
};
const leads = createInitialForwardingState().leads;
const original: LeadInput = { ...leads.find(({ id }) => id === "L29")!, institution: "Test Institute", email: "first@clinic-mail.org" };
const second: LeadInput = { ...original, id: "L99", institution: " TEST  INSTITUTE ", email: "second@CLINIC-MAIL.org" };

function assessed(lead: LeadInput, assessment: Assessment, eventAt = at): ForwardingEvent {
  const workflow = assessment.verdict === "country-check" || assessment.verdict === "partnership-check" ? "reply-pending" : "decision-pending";
  return { type: "assessed", id: `${lead.id}:${eventAt === at ? "first" : "later"}`, leadId: lead.id, at: eventAt, assessment, workflow };
}

test("domain confirmation preserves other checks and changes no frozen assessment data", () => {
  const baseline = { ...unresolved, details: { ...unresolved.details!, countries: ["독일"], memoIntent: "partnership" as const } };
  const result = applyDirectionConfirmation(original, baseline, answer({ kind: "domain", choice: "yes" }));
  assert.equal(result.verdict, "country-check");
  assert.equal(result.details?.domain, "matched");
  assert.deepEqual(result.details?.countries, ["독일"]);
  assert.equal(result.details?.memoIntent, "partnership");
  assert.deepEqual(result.sources, baseline.sources);
  assert.equal(result.directionQuestion, undefined);
  assert.equal(baseline.details.domain, "unverified");
  assert.equal(applyDirectionConfirmation(original, baseline, answer({ kind: "location", choice: "yes" })), baseline);
});

test("only an explicit answer can clear spoof suspicion, and fictional invalid is left alone", async () => {
  const service = createAssessmentService();
  const state = createInitialForwardingState();
  const lead = leads.find(({ id }) => id === "L29")!;
  const intent = lookupSavedInquiryIntent(lead.memo, savedInquiryIntents);
  const { assessment } = await service.assess(lead, { mode: "sample", intent });
  assert.equal(getDirectionQuestion(lead, assessment).kind, "spoof");
  const confirmation = answer({ kind: "spoof", choice: "yes" });
  const result = applyDirectionConfirmation(lead, assessment, confirmation, state);
  assert.equal(result.verdict, "valid");
  assert.equal(result.handoff?.kind, "dealer");
  assert.equal(applyDirectionConfirmation(lead, assessment, { ...confirmation, previous: true }), assessment);
  const fake = leads.find(({ id }) => id === "L18")!;
  const { assessment: invalid } = await service.assess(fake, { mode: "sample" });
  assert.equal(invalid.verdict, "invalid");
  assert.equal(applyDirectionConfirmation(fake, invalid, confirmation), invalid);

  const industry = getSavedIndustry("b2b-saas")!;
  const saasLead = industry.demo.seed.leads.find(({ id }) => id === "I09")!;
  const savedIntent = lookupSavedInquiryIntent(saasLead.memo, savedInquiryIntents);
  const { assessment: saasAssessment } = assessSavedIndustryLead(industry, saasLead, saasLead.country, savedIntent);
  const rejected = applyDirectionConfirmation(saasLead, saasAssessment, answer({ kind: "spoof", choice: "no" }));
  assert.deepEqual([rejected.verdict, rejected.handoff?.kind], ["invalid", "none"]);
});

test("same-domain memory is scoped to the institution and retains the original answer record", () => {
  const state = createInitialForwardingState();
  const result = applyDirectionConfirmation(original, unresolved, answer({ kind: "domain", choice: "yes" }), state);
  const historical = { ...state, leads: [original, second], events: [assessed(original, result)] };
  const remembered = directionConfirmationFor(historical, second, unresolved);
  assert.deepEqual(remembered, { ...result.directionConfirmation, previous: true });
  const confirmed = applyDirectionConfirmation(second, unresolved, remembered!, state);
  assert.equal(confirmed.verdict, "valid");
  assert.equal(confirmed.directionConfirmation?.at, at);
  assert.equal(directionConfirmationFor(historical, { ...second, institution: "Other Institute" }, unresolved), undefined);
  assert.equal(directionConfirmationFor(historical, { ...second, email: "second@mail.clinic-mail.org" }, unresolved), undefined);
  assert.equal(directionConfirmationFor(historical, second, { ...unresolved, verdict: "invalid" }), undefined);
  const unrelatedSpoof = { ...unresolved, details: { ...unresolved.details!, domain: "suspicious" as const } };
  assert.equal(directionConfirmationFor(historical, second, unrelatedSpoof), undefined);
});

test("an institution location answer is reused across its domains, even with a different entered country", () => {
  const state = createInitialForwardingState();
  const noLocation = { ...unresolved, details: { ...unresolved.details!, domain: "matched" as const, countries: [] } };
  const result = applyDirectionConfirmation(original, noLocation, answer({ kind: "location", choice: "yes" }), state);
  assert.equal(result.directionConfirmation?.country, "미국");
  const next = { ...second, country: "독일", email: "next@alternate-clinic.org" };
  const history = { ...state, leads: [original, next], events: [assessed(original, result)] };
  const remembered = directionConfirmationFor(history, next, noLocation);
  assert.equal(remembered?.country, "미국");
  const confirmed = applyDirectionConfirmation(next, noLocation, remembered!, state);
  assert.equal(confirmed.verdict, "valid");
  assert.deepEqual(confirmed.details?.countries, ["미국"]);
  assert.deepEqual(confirmed.handoff, result.handoff);
});

test("a follow-up intent answer preserves the already confirmed location without crediting the model", () => {
  const state = createInitialForwardingState();
  const noLocation = { ...unresolved, details: { ...unresolved.details!, domain: "matched" as const, countries: [], memoIntent: "unknown" as const } };
  const located = applyDirectionConfirmation(original, noLocation, answer({ kind: "location", choice: "other-country", country: "독일" }), state);
  assert.equal(located.verdict, "ambiguous");
  assert.equal(getDirectionQuestion(original, located).kind, "intent");
  const purchased = applyDirectionConfirmation(original, located, answer({ kind: "intent", choice: "yes" }), state);
  assert.equal(purchased.verdict, "valid");
  assert.deepEqual(purchased.details?.countries, ["독일"]);
  assert.equal(purchased.details?.memoSource, undefined);
  assert.equal(purchased.details?.memoQuote, null);
});

test("confirmation and rejudgment persist together and reset clears their memory", () => {
  let raw: string | null = null;
  const storage = { getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; }, removeItem: () => { raw = null; } };
  const store = createForwardingStore(storage);
  const state = store.snapshot();
  const lead = state.leads.find(({ id }) => id === "L29")!;
  const question = { ...unresolved, details: { ...unresolved.details!, domain: "suspicious" as const } };
  assert.equal(store.append(assessed(lead, question)).ok, true);
  const confirmed = applyDirectionConfirmation(lead, question, answer({ kind: "spoof", choice: "unknown" }), state);
  assert.equal(store.append(assessed(lead, confirmed, later)).ok, true);
  const refreshed = createForwardingStore(storage);
  const restored = refreshed.hydrate();
  assert.equal(restored.ok, true);
  assert.deepEqual(restored.state.leadStates[lead.id].assessment?.directionConfirmation, confirmed.directionConfirmation);
  assert.equal(restored.state.leadStates[lead.id].assessment?.handoff?.kind, "regional-sales");
  assert.equal(directionConfirmationFor(restored.state, lead, question)?.choice, "unknown");
  assert.equal(applyForwardingEvent(restored.state, { ...assessed(lead, confirmed, later), id: "forged", assessment: {
    ...confirmed, directionConfirmation: { ...confirmed.directionConfirmation, previous: true },
  } }).ok, false);
  assert.equal(refreshed.reset().ok, true);
  assert.equal(directionConfirmationFor(refreshed.snapshot(), lead, question), undefined);
});
