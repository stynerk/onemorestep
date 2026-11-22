import assert from "node:assert/strict";
import { test } from "node:test";
import { createAssessmentService } from "../src/lib/forwarding/assessment-service";
import type { DomainEvidenceAdvice } from "../src/lib/forwarding/domain-router";
import { createForwardingStore } from "../src/lib/forwarding/store";
import type { LeadInput } from "../src/lib/forwarding/types";
import { classifyLead, classifyLeadWithDomainEvidence, type SearchEvidence } from "../src/lib/forwarding/verdict";

const at = "2026-11-19T12:00:00.000Z";
const lead: LeadInput = {
  id: "synthetic", institution: "Ridgecrane Research Lab", name: "Synthetic Buyer", email: "purchases@buy.ridgecrane.org", phone: "",
  country: "미국", memo: "Please send a purchase quote.", product: "PM-50", receivedAt: at,
};
const contact = {
  title: "Ridgecrane Research Lab · Contact",
  url: "https://audit.ridgecrane.org/contact",
  description: "Headquarters address in Ohio, United States. E-mail: office@buy.ridgecrane.org.",
};
const belongs: DomainEvidenceAdvice = {
  ownership: "belongs", quote: "office@buy.ridgecrane.org", url: contact.url,
  location: { country: "미국", quote: "Headquarters address in Ohio, United States.", url: contact.url },
};
const evidence: SearchEvidence = { sources: [contact], kind: "liner", status: "complete", searchedAt: at };

test("validated first-party contact ownership resumes the existing country and intent decisions", () => {
  const prior = classifyLead(lead, evidence);
  assert.equal(prior.assessment.verdict, "ambiguous");
  assert.equal(prior.assessment.details?.domain, "unverified");

  const matched = classifyLead(lead, evidence, lead.country, null, belongs);
  assert.equal(matched.assessment.details?.domain, "matched");
  assert.equal(matched.assessment.verdict, "valid");
  assert.deepEqual(matched.assessment.details?.domainEvidence, belongs);
  assert.deepEqual(matched.assessment.details?.countries, ["미국"]);
  assert.deepEqual(matched.assessment.sources, [contact.url]);

  const foreign = { ...lead, country: "독일" };
  const countryCheck = classifyLead(foreign, evidence, foreign.country, null, belongs);
  assert.equal(countryCheck.assessment.verdict, "country-check");
  assert.deepEqual(countryCheck.assessment.handoff, { kind: "regional-sales", region: "EU" });
  assert.equal(countryCheck.workflow, "reply-pending");

  const partner = { ...lead, memo: "We propose a reseller partnership." };
  assert.equal(classifyLead(partner, evidence, lead.country, null, belongs).assessment.verdict, "partnership-check");
  const uncertain = { ...lead, memo: "Would you reach out soon?" };
  const advised = classifyLead(uncertain, evidence, lead.country, { intent: "buying", quote: uncertain.memo }, belongs);
  assert.equal(advised.assessment.verdict, "ambiguous");
  assert.equal(advised.assessment.details?.domain, "matched");
});

test("positive advice needs the quoted source, an institutional owner and a direct ownership field", () => {
  const prior = classifyLead(lead, evidence);
  for (const invalid of [
    { ...belongs, quote: "sales@buy.ridgecrane.org" },
    { ...belongs, url: "https://offsite.example.org/contact" },
    { ...belongs, location: { country: "캐나다", quote: "Fabricated Canada location", url: contact.url } },
  ]) {
    assert.deepEqual(classifyLead(lead, evidence, lead.country, null, invalid), prior);
  }
  for (const source of [
    { ...contact, title: "Institute Directory", url: "https://directory.ridgecrane.org/contact" },
    { ...contact, title: "Employee Listings", url: "https://listings-junction.org/contact" },
    { ...contact, description: "Our supplier in Ohio uses this address. E-mail: office@buy.ridgecrane.org." },
    { ...contact, description: "Our headquarters is in Ohio. Our blog mentioned office@buy.ridgecrane.org once." },
    { ...contact, url: "https://audit.co.uk/contact", description: "E-mail: office@buy.co.uk." },
  ]) {
    const input = source.url.includes("audit.co.uk") ? { ...lead, email: "purchases@buy.co.uk" } : lead;
    const check = { ...evidence, sources: [source] };
    const quote = input === lead ? belongs.quote : "office@buy.co.uk";
    assert.deepEqual(
      classifyLead(input, check, input.country, null, { ...belongs, quote, url: source.url, location: null }),
      classifyLead(input, check),
    );
  }
});

test("location evidence is tied to the precise source excerpt and cannot replace a conflicting country", () => {
  const unrelatedExcerpt = {
    url: contact.url, title: "Unrelated listing", description: "Headquarters address in Toronto, Canada.",
  };
  const duplicate = { ...evidence, sources: [unrelatedExcerpt, contact] };
  const exact = classifyLead(lead, duplicate, lead.country, null, belongs);
  assert.deepEqual(exact.assessment.details?.countries, ["미국"]);
  assert.deepEqual(exact.assessment.details?.domainEvidence?.location, belongs.location);

  const conflict: DomainEvidenceAdvice = {
    ...belongs, location: { country: "캐나다", quote: unrelatedExcerpt.description, url: unrelatedExcerpt.url },
  };
  const rejectedLocation = classifyLead(lead, duplicate, lead.country, null, conflict);
  assert.equal(rejectedLocation.assessment.verdict, "valid");
  assert.deepEqual(rejectedLocation.assessment.details?.countries, ["미국"]);
  assert.equal(rejectedLocation.assessment.details?.domainEvidence?.location, null);

  const former = { ...contact, description: "Former address in Toronto, Canada. E-mail: office@buy.ridgecrane.org." };
  const oldAddress = classifyLead(lead, { ...evidence, sources: [former] }, lead.country, null, {
    ...belongs, location: { country: "캐나다", quote: "Former address in Toronto, Canada.", url: former.url },
  });
  assert.equal(oldAddress.assessment.verdict, "ambiguous");
  assert.deepEqual(oldAddress.assessment.details?.countries, []);
  assert.equal(oldAddress.assessment.details?.domainEvidence?.location, null);
});

test("unverified negative advice annotates only, and protected or failed assessments skip the resolver", async () => {
  for (const ownership of ["not_belongs", "unknown"] as const) {
    const baseline = classifyLead(lead, evidence).assessment;
    const next = await classifyLeadWithDomainEvidence(lead, evidence, lead.country, null, () => ({
      ownership, quote: contact.title, url: contact.url, location: null,
    }));
    assert.equal(next.assessment.verdict, baseline.verdict);
    assert.deepEqual(next.assessment.handoff, baseline.handoff);
    assert.equal(next.assessment.details?.domainEvidence?.ownership, ownership);
  }
  assert.deepEqual(await classifyLeadWithDomainEvidence(lead, evidence, lead.country, null, () => {
    throw new Error("A resolver may be offline");
  }), classifyLead(lead, evidence));

  const protectedCases: [LeadInput, SearchEvidence][] = [
    [{ ...lead, email: "x@gmail.com" }, evidence],
    [{ ...lead, email: "x@ridgecrane.test" }, evidence],
    [{ ...lead, institution: "Fictional Company", email: "x@fictional.test" }, { ...evidence, sources: [] }],
    [{ ...lead, email: "x@audit.ridgecrane.org" }, evidence],
    [lead, { ...evidence, status: "failed" }],
    [lead, { ...evidence, status: "saved-unavailable" }],
    [lead, { ...evidence, sources: [] }],
  ];
  let calls = 0;
  for (const [input, result] of protectedCases) {
    const guarded = await classifyLeadWithDomainEvidence(input, result, input.country, null, () => {
      calls += 1;
      return belongs;
    });
    assert.deepEqual(guarded, classifyLead(input, result));
  }
  assert.equal(calls, 0);
});

test("service only resolves domain advice after existing search completes with its four allowed fields", async () => {
  let fetched = 0;
  const service = createAssessmentService({ fetcher: async (_url, init) => {
    assert.equal(init?.method, "POST");
    fetched += 1;
    return Response.json({ results: [contact] });
  } });
  const outcome = await service.assess(lead, { mode: "live", apiKey: "test-only", domainAdvice: (input) => {
    assert.equal(fetched, 2);
    assert.deepEqual(Object.keys(input), ["institution", "emailDomain", "country", "sources"]);
    assert.equal(input.emailDomain, "buy.ridgecrane.org");
    assert.deepEqual(input.sources, [contact, contact]);
    return belongs;
  } });
  assert.equal(outcome.assessment.details?.domainEvidence?.ownership, "belongs");

  let calls = 0;
  const failed = createAssessmentService({ fetcher: async () => new Response(null, { status: 503 }) });
  const fallback = await failed.assess(lead, { mode: "live", apiKey: "test-only", domainAdvice: () => {
    calls += 1;
    return belongs;
  } });
  assert.equal(fallback.assessment.details?.externalStatus, "failed");
  assert.equal(fallback.assessment.details?.domainEvidence, undefined);
  assert.equal(calls, 0);
});

test("v1 storage preserves trusted proof links and rejects missing provenance or unsafe URLs", () => {
  const assessment = classifyLead(lead, evidence, lead.country, null, belongs).assessment;
  const values = new Map<string, string>();
  const storage = {
    getItem(key: string) { return values.get(key) ?? null; },
    setItem(key: string, value: string) { values.set(key, value); },
    removeItem(key: string) { values.delete(key); },
  };
  const store = createForwardingStore(storage);
  const event = { at, leadId: "L03", type: "assessed", assessment, workflow: "decision-pending" };
  assert.equal(store.append({ ...event, id: "model-domain" }).ok, true);
  assert.deepEqual(createForwardingStore(storage).hydrate().state.leadStates.L03.assessment?.details?.domainEvidence, belongs);
  for (const url of ["https://not-a-result.example.net/contact", "javascript:alert(1)"]) {
    const modified = { ...assessment, details: { ...assessment.details, domainEvidence: { ...belongs, url } } };
    assert.equal(store.append({ ...event, id: "unsafe-model-domain", assessment: modified }).ok, false);
  }
});
