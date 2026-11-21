import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "../src/app/api/forwarding/assess/route";
import { createAssessmentService } from "../src/lib/forwarding/assessment-service";
import { createInitialForwardingState } from "../src/lib/forwarding/seed";
import { createForwardingStore } from "../src/lib/forwarding/store";
import type { LeadInput } from "../src/lib/forwarding/types";
import { classifyLead, matchesDomain } from "../src/lib/forwarding/verdict";
import type { Source } from "../src/lib/liner-search";

const leads = createInitialForwardingState().leads;
const getLead = (id: string) => leads.find((lead) => lead.id === id)!;
const at = "2026-11-18T12:00:00.000Z";
const live = { mode: "live", apiKey: "test-key" };
const cleveland = { title: "Cleveland Clinic Locations", url: "https://my.clevelandclinic.org/locations", description: "Main campus address in Cleveland, Ohio." };
const charite = { title: "Charité – Universitätsmedizin Berlin", url: "https://www.charite.de/en/", description: "The university hospital is located in Berlin, Germany." };
const tokyo = { title: "The University of Tokyo Hospital", url: "https://www.h.u-tokyo.ac.jp/english/", description: "Hospital address in Tokyo, Japan." };
const evidence = (sources: Source[]) => ({ sources, searchedAt: at, kind: "liner" as const, status: "complete" as const });
const res = (sources: Source[]) => Response.json({ results: sources });
const request = (payload: unknown, contentType = "application/json") => new Request("http://localhost/api/forwarding/assess", {
  method: "POST", headers: { "Content-Type": contentType }, body: JSON.stringify(payload),
});
const syntheticLead: LeadInput = {
  id: "synthetic-buyer", name: "Test Buyer", email: "orders@ridgeleaf-institute.org", phone: "",
  institution: "Ridgeleaf Research Institute", country: "미국", product: "PM-50", memo: "Requesting a purchase quote.", receivedAt: at,
};
const syntheticSource: Source = {
  title: "Ridgeleaf Research Institute", url: "https://ridgeleaf-institute.org/contact", description: "Contact address in Ohio, United States.",
};

test("completed searches recognize an unregistered institution by name and related email and source hosts", () => {
  const domains = [
    ["ridgeleaf-institute.org", "ridgeleaf-institute.org"],
    ["ridgeleaf-institute.org", "www.ridgeleaf-institute.org"],
    ["purchasing.ridgeleaf-institute.org", "ridgeleaf-institute.org"],
  ];
  for (const [emailHost, sourceHost] of domains) {
    const lead = { ...syntheticLead, email: "orders@" + emailHost };
    const source = { ...syntheticSource, url: "https://" + sourceHost + "/contact" };
    for (const kind of ["liner", "cache", "mixed"] as const) {
      const { assessment } = classifyLead(lead, { ...evidence([source]), kind });
      assert.equal(assessment.verdict, "valid", kind + " " + emailHost + " " + sourceHost);
      assert.equal(assessment.details?.domain, "matched");
      assert.deepEqual(assessment.details?.countries, ["미국"]);
    }
    assert.equal(classifyLead(lead, { ...evidence([source]), kind: "curated" }).assessment.details?.domain, "unverified");
    assert.equal(classifyLead(lead, { ...evidence([source]), status: "failed" }).assessment.details?.domain, "unverified");
  }
  const { assessment } = classifyLead(syntheticLead, evidence([{ ...syntheticSource, description: "Public institution profile." }]));
  assert.equal(assessment.details?.domain, "matched");
  assert.deepEqual(assessment.details?.countries, []);
  assert.equal(assessment.verdict, "ambiguous");
});

test("generic name variants match either display language and still require a distinctive name", () => {
  for (const [institution, title] of [
    ["리지리프 연구소（Ridgeleaf Research Institute）", "Ridgeleaf Research Institute"],
    ["리지리프 연구소 Ridgeleaf Research Institute", "리지리프 연구소"],
    ["Ridgeleaf Research Institute / 리지리프 연구소", "리지리프 연구소"],
  ]) {
    const { assessment } = classifyLead({ ...syntheticLead, institution }, evidence([{ ...syntheticSource, title }]));
    assert.equal(assessment.verdict, "valid", institution);
  }
  const genericVariant = classifyLead(
    { ...syntheticLead, institution: "Ridgeleaf Research Institute (Medical Center)" },
    evidence([{ ...syntheticSource, title: "Medical Center" }]),
  );
  assert.equal(genericVariant.assessment.details?.domain, "unverified");
  const wrongTitle = classifyLead(syntheticLead, evidence([{ ...syntheticSource, title: "Ridgeleaf Research Institutes" }]));
  assert.equal(wrongTitle.assessment.details?.domain, "unverified");
});

test("inference rejects non-boundary hosts, sibling hosts, and third-party or free-email hosts", () => {
  const domains = [
    ["ridgeleaf-institute.org", "fake-ridgeleaf-institute.org"],
    ["ridgeleaf-institute.org", "ridgeleaf-institute.org.attacker.org"],
    ["mail.ridgeleaf-institute.org", "www.ridgeleaf-institute.org"],
    ["ridgeleaf-institute.org", "news.ridgeleaf-institute.org"],
    ["ridgeleaf-institute.org", "directory.ridgeleaf-institute.org"],
    ["wikipedia.org", "en.wikipedia.org"],
    ["linkedin.com", "www.linkedin.com"],
    ["healthgrades.com", "www.healthgrades.com"],
    ["gmail.com", "gmail.com"],
  ];
  for (const [emailHost, sourceHost] of domains) {
    const { assessment } = classifyLead(
      { ...syntheticLead, email: "orders@" + emailHost },
      evidence([{ ...syntheticSource, url: "https://" + sourceHost + "/contact" }]),
    );
    assert.equal(assessment.verdict, "ambiguous", emailHost + " " + sourceHost);
    assert.notEqual(assessment.details?.domain, "matched");
    assert.deepEqual(assessment.details?.countries, []);
  }
});

test("a completed no-match purchase needs a plausible work address and routes to regional sales", () => {
  for (const kind of ["liner", "cache", "mixed"] as const) {
    const { assessment } = classifyLead(syntheticLead, { ...evidence([]), kind }, "독일");
    assert.equal(assessment.verdict, "ambiguous");
    assert.deepEqual(assessment.handoff, { kind: "regional-sales", region: "EU" });
    assert.match(assessment.reason, /공개 검색에서 기관을 확인하지 못해/u);
  }
  assert.equal(classifyLead(syntheticLead, { ...evidence([]), kind: "curated" }).assessment.verdict, "invalid");
  for (const lead of [
    { ...syntheticLead, institution: "none" },
    { ...syntheticLead, email: "orders@gmail.com" },
    { ...syntheticLead, email: "orders@192.0.2.1" },
    { ...syntheticLead, email: "orders@ridgeleaf.test" },
    { ...syntheticLead, email: "orders@sub.example.org" },
    { ...syntheticLead, memo: "Sending a note for reference." },
    { ...syntheticLead, memo: "Requesting a purchase quote. Guaranteed investment returns." },
  ]) {
    const { assessment } = classifyLead(lead, evidence([]));
    assert.equal(assessment.verdict, "invalid", JSON.stringify(lead));
    assert.deepEqual(assessment.handoff, { kind: "none" });
  }
  const example = classifyLead(
    { ...syntheticLead, email: "orders@ridgeleaf.example" },
    evidence([{ ...syntheticSource, url: "https://ridgeleaf.example/contact" }]),
  );
  assert.equal(example.assessment.verdict, "invalid");
});

test("an independent public institution match makes reserved and lookalike email domains suspicious", () => {
  const copiedPage = { ...syntheticSource, url: "https://ridgeleaf-institute.test/contact" };
  for (const email of [
    "orders@ridgeleaf-institute.test",
    "orders@inquiries.example.org",
    "orders@ridgeleaf-forms.org",
    "orders@ridgeleaf-institute.net",
    "orders@ridgeleaf-institute.org.mailer.co",
  ]) {
    for (const kind of ["liner", "cache", "mixed"] as const) {
      const { assessment } = classifyLead({ ...syntheticLead, email }, { ...evidence([copiedPage, syntheticSource]), kind });
      assert.equal(assessment.verdict, "ambiguous", email);
      assert.equal(assessment.details?.domain, "suspicious", email);
      assert.deepEqual(assessment.handoff, { kind: "regional-sales", region: "NA" });
      assert.deepEqual(assessment.details?.countries, []);
    }
  }
  const fake = classifyLead({ ...syntheticLead, email: "orders@ridgeleaf-institute.test" }, evidence([
    copiedPage,
    { ...syntheticSource, title: "Another Research Institute" },
    { ...syntheticSource, url: "https://directory.ridgeleaf-institute.org/contact" },
  ]));
  assert.equal(fake.assessment.verdict, "invalid");
  assert.deepEqual(fake.assessment.handoff, { kind: "none" });

  const verified = classifyLead(syntheticLead, evidence([copiedPage, syntheticSource]));
  assert.equal(verified.assessment.verdict, "valid");
  assert.equal(verified.assessment.details?.domain, "matched");
  const sibling = classifyLead(
    { ...syntheticLead, email: "orders@mail.ridgeleaf-institute.org" },
    evidence([{ ...syntheticSource, url: "https://www.ridgeleaf-institute.org/contact" }]),
  );
  assert.equal(sibling.assessment.details?.domain, "unverified");
});

test("acronym matches in glossaries and software results do not corroborate a reserved-email institution", () => {
  const lead = { ...syntheticLead, institution: "QDX", email: "orders@qdx.test" };
  const unrelated = [
    { title: "QDX — translation examples", url: "https://wordbook.org/qdx", description: "Translations, inflections and example sentences." },
    { title: "QDX serialization failure", url: "https://codeforge.org/issues/108", description: "The patch fixes a memory address mismatch." },
    { title: "Getting started", url: "https://qdx-tools.org/docs", description: "Install QDX from the package manager and configure your workspace." },
  ];
  const fake = classifyLead(lead, evidence(unrelated));
  assert.equal(fake.assessment.verdict, "invalid");
  assert.deepEqual(fake.assessment.handoff, { kind: "none" });

  for (const description of ["An independent research institute.", "Our headquarters address is in Ohio, United States."]) {
    const source = { title: "About QDX", url: "https://qdx.org/about", description };
    const { assessment } = classifyLead(lead, evidence([...unrelated, source]));
    assert.equal(assessment.verdict, "ambiguous");
    assert.equal(assessment.details?.domain, "suspicious");
    assert.deepEqual(assessment.handoff, { kind: "regional-sales", region: "NA" });
  }
});

test("a reserved-email institution can be corroborated by its distinctive name in both title and host", () => {
  const lead = { ...syntheticLead, institution: "Cedarvale Research", email: "orders@cedarvale.test" };
  const branded = { title: "Cedarvale Research", url: "https://WWW.CEDARVALE.org/about", description: "Explore our work." };
  for (const source of [branded, { ...branded, title: "CEDARVALE RESEARCH – Our work", url: "https://cedarvaleresearch.org/about" }]) {
    const { assessment } = classifyLead(lead, evidence([source]));
    assert.equal(assessment.verdict, "ambiguous");
    assert.equal(assessment.details?.domain, "suspicious");
    assert.deepEqual(assessment.handoff, { kind: "regional-sales", region: "NA" });
  }

  for (const source of [
    { ...branded, url: "https://wordbook.org/cedarvale" },
    { ...branded, url: "https://uncedarvale.org/about" },
    { ...branded, url: "https://cedarvaleresearchers.org/about" },
    { ...branded, url: "https://research.org/about" },
    { ...branded, title: "Getting started", description: "Install the Cedarvale Research package." },
    { ...branded, title: "Translation of Cedarvale Research" },
    { ...branded, title: "Cedarvale Researches", description: "A guide to Cedarvale Research." },
  ]) {
    assert.equal(classifyLead(lead, evidence([source])).assessment.verdict, "invalid", source.title + " " + source.url);
  }
});

test("a name match on the claimed host cannot override configured impersonation checks", () => {
  const configuredLead = { ...syntheticLead, institution: "Cleveland Clinic", email: "orders@clevelandclinic-lookup.test" };
  const claimedSource = { ...cleveland, url: "https://clevelandclinic-lookup.test/contact" };
  const lookalike = classifyLead(configuredLead, evidence([cleveland, claimedSource]));
  assert.equal(lookalike.assessment.verdict, "ambiguous");
  assert.equal(lookalike.assessment.details?.domain, "suspicious");
  const withoutOfficial = classifyLead(configuredLead, evidence([claimedSource]));
  assert.equal(withoutOfficial.assessment.verdict, "ambiguous");
  assert.equal(withoutOfficial.assessment.details?.domain, "unverified");
  const otherInstitution = classifyLead(
    { ...syntheticLead, email: "orders@clevelandclinic.org" },
    evidence([{ ...cleveland, title: syntheticLead.institution }]),
  );
  assert.equal(otherInstitution.assessment.verdict, "ambiguous");
  assert.equal(otherInstitution.assessment.details?.domain, "suspicious");
});

test("official domains are checked at a dot boundary; lookalikes and ambiguous domains diverge", () => {
  assert.equal(matchesDomain("h.u-tokyo.ac.jp", "u-tokyo.ac.jp"), true);
  assert.equal(matchesDomain("evil-u-tokyo.ac.jp", "u-tokyo.ac.jp"), false);
  const lead = getLead("L02");
  const actual = classifyLead(lead, evidence([tokyo]));
  assert.equal(actual.assessment.verdict, "valid");
  assert.equal(actual.assessment.details?.domain, "matched");
  const poisoned = classifyLead({ ...lead, email: "example@evil-u-tokyo.ac.jp" }, evidence([tokyo]));
  assert.equal(poisoned.assessment.verdict, "ambiguous");
  assert.equal(poisoned.assessment.details?.domain, "suspicious");
  assert.match(poisoned.assessment.reason, /사칭 의심/u);
  assert.deepEqual(poisoned.assessment.handoff, { kind: "regional-sales", region: "APAC" });
  const unknown = classifyLead({ ...lead, email: "example@dominio.example" }, evidence([tokyo]));
  assert.equal(unknown.assessment.verdict, "ambiguous");
  assert.equal(unknown.assessment.details?.domain, "suspicious");
  const alias = classifyLead(getLead("L03"), evidence([cleveland]));
  assert.equal(alias.assessment.verdict, "valid");
  assert.ok(alias.assessment.sources.some((source) => source.includes("privacy-security")));
  const foreign = classifyLead({ ...lead, email: "example@charite.de" }, evidence([tokyo, charite]));
  assert.equal(foreign.assessment.verdict, "ambiguous");
  assert.equal(foreign.assessment.details?.domain, "suspicious");
  assert.match(foreign.assessment.reason, /사칭 의심/u);
  assert.deepEqual(foreign.assessment.handoff, { kind: "regional-sales", region: "APAC" });
});

test("third-party pages and unrelated official text do not supply institution location evidence", () => {
  const lead = getLead("L02");
  for (const url of ["https://en.wikipedia.org/wiki/University_of_Tokyo_Hospital", "https://news.example/tokyo", "https://directory.example/tokyo"]) {
    const thirdParty = classifyLead(lead, evidence([{ ...tokyo, url }]));
    assert.equal(thirdParty.assessment.verdict, "ambiguous");
    assert.equal(thirdParty.assessment.details?.domain, "unverified");
  }
  const affiliationOnly = evidence([{ ...tokyo, description: "Our hospital works with international partners from Australia." }]);
  const inferred = classifyLead(lead, affiliationOnly);
  assert.equal(inferred.assessment.verdict, "valid");
  assert.deepEqual(inferred.assessment.details?.countries, ["일본"]);
  assert.match(inferred.assessment.reason, /도메인의 국가 코드/);
  const saved = classifyLead(lead, { ...affiliationOnly, kind: "curated" });
  assert.equal(saved.assessment.verdict, "ambiguous");
  assert.deepEqual(saved.assessment.details?.countries, []);
  const multiple = classifyLead(lead, evidence([tokyo, { ...tokyo, description: "Second campus located in Australia." }]));
  assert.equal(multiple.assessment.verdict, "ambiguous");
  assert.deepEqual(multiple.assessment.details?.countries, ["일본", "호주"]);
});

test("country check precedes partnership, and industry is informational on L11", () => {
  const partner = { ...getLead("L12"), memo: "Co-marketing partnership" };
  const awaitingCountry = classifyLead(partner, evidence([charite]));
  assert.equal(awaitingCountry.assessment.verdict, "country-check");
  assert.equal(awaitingCountry.workflow, "reply-pending");
  assert.equal(classifyLead({ ...partner, country: "독일" }, evidence([charite])).assessment.verdict, "partnership-check");
  const toyota = { title: "Toyota Motor Corporation", url: "https://global.toyota/en/company/profile/overview/", description: "Automotive company headquarters address in Aichi, Japan." };
  const outside = classifyLead(getLead("L11"), evidence([toyota]));
  assert.equal(outside.assessment.verdict, "valid");
  assert.equal(outside.assessment.details?.industry, "자동차");
  assert.equal(classifyLead(getLead("L11"), evidence([{ ...toyota, description: "Hospital address in Aichi, Japan." }])).assessment.verdict, "valid");
  const noIntent = classifyLead({ ...getLead("L11"), memo: "For reference" }, evidence([toyota]));
  assert.equal(noIntent.assessment.verdict, "ambiguous");
});

test("live fallback uses supported country suffixes from official domains or verified aliases", () => {
  const rows = [
    ["L02", tokyo.url, "일본", "valid"],
    ["L07", "https://www.thermh.org.au/contact", "호주", "valid"],
    ["L11", "https://global.toyota/en/company/profile/overview/", "일본", "valid"],
    ["L12", charite.url, "독일", "country-check"],
  ] as const;
  for (const [leadId, url, country, verdict] of rows) {
    const lead = getLead(leadId);
    const input = evidence([{ title: lead.institution, url, description: "Public institution profile." }]);
    for (const kind of ["liner", "cache", "mixed"] as const) {
      const { assessment } = classifyLead(lead, { ...input, kind });
      assert.equal(assessment.verdict, verdict, leadId);
      assert.deepEqual(assessment.details?.countries, [country], leadId);
      assert.match(assessment.reason, /도메인의 국가 코드/);
    }
    const saved = classifyLead(lead, { ...input, kind: "curated" });
    assert.equal(saved.assessment.verdict, "ambiguous");
    assert.deepEqual(saved.assessment.details?.countries, []);
  }
});

test("generic, unsupported, unverified and incomplete results supply no fallback country", () => {
  const generic = [
    ["L03", cleveland.url], // Official .org and verified .org.
    ["L05", "https://sev.severance.healthcare/sev-en/about/network.do"], // Verified .ac.
    ["L14", "https://www.apollohospitals.com/hospitals/"], // Official .com.
  ] as const;
  for (const [leadId, url] of generic) {
    const lead = getLead(leadId);
    const { assessment } = classifyLead(lead, evidence([{ title: lead.institution, url, description: "Public institution profile." }]));
    assert.equal(assessment.details?.domain, "matched", leadId);
    assert.deepEqual(assessment.details?.countries, [], leadId);
    assert.equal(assessment.verdict, "ambiguous", leadId);
  }

  const lead = getLead("L07");
  const official = { title: lead.institution, url: "https://www.thermh.org.au/contact", description: "Public hospital profile." };
  const unverified = classifyLead({ ...lead, email: "demo@unverified.example.jp" }, evidence([official]));
  assert.equal(unverified.assessment.verdict, "ambiguous");
  assert.equal(unverified.assessment.details?.domain, "unverified");
  assert.deepEqual(unverified.assessment.details?.countries, []);

  const thirdParty = { ...official, url: "https://directory.example.au/royal-melbourne-hospital" };
  const missingOfficial = classifyLead(lead, evidence([thirdParty]));
  assert.equal(missingOfficial.assessment.details?.domain, "matched"); // Verified alias alone cannot establish existence.
  assert.equal(missingOfficial.assessment.verdict, "ambiguous");
  assert.deepEqual(missingOfficial.assessment.details?.countries, []);

  const incomplete = classifyLead(lead, { ...evidence([official]), status: "failed" });
  assert.equal(incomplete.assessment.verdict, "ambiguous");
  assert.deepEqual(incomplete.assessment.details?.countries, []);
});

test("explicit and conflicting countries precede domain fallback, with a live partnership exception for unresolved country", () => {
  const lead = getLead("L02");
  const explicit = classifyLead(lead, evidence([{ ...tokyo, description: "Hospital address in Seoul, Republic of Korea." }]));
  assert.equal(explicit.assessment.verdict, "country-check");
  assert.deepEqual(explicit.assessment.details?.countries, ["대한민국"]);
  assert.doesNotMatch(explicit.assessment.reason, /도메인의 국가 코드/);

  const conflict = evidence([tokyo, { ...tokyo, description: "Second campus address in Melbourne, Australia." }]);
  const buy = classifyLead(lead, conflict);
  assert.equal(buy.assessment.verdict, "ambiguous");
  assert.deepEqual(buy.assessment.details?.countries, ["일본", "호주"]);

  const partnership = { ...lead, memo: "Co-marketing partnership" };
  const mixed = classifyLead(partnership, { ...conflict, kind: "mixed" });
  assert.equal(mixed.assessment.verdict, "partnership-check");
  assert.deepEqual(mixed.assessment.details?.countries, ["일본", "호주"]);
  assert.match(mixed.assessment.reason, /기관 소재지/);
  assert.equal(classifyLead(partnership, { ...conflict, kind: "curated" }).assessment.verdict, "ambiguous");
  assert.equal(classifyLead({ ...partnership, country: "대한민국" }, evidence([tokyo])).assessment.verdict, "country-check");

  for (const [leadId, url] of [["L22", "https://www.hyundai.com/"], ["L23", "https://www.pfizer.com/contact"]] as const) {
    const partner = getLead(leadId);
    const generic = evidence([{ title: partner.institution, url, description: "Public company profile." }]);
    const undecided = classifyLead(partner, generic);
    assert.equal(undecided.assessment.verdict, "partnership-check", leadId);
    assert.deepEqual(undecided.assessment.details?.countries, [], leadId);
    assert.equal(classifyLead({ ...partner, email: "demo@unverified.example.jp" }, generic).assessment.verdict, "ambiguous");
    assert.equal(classifyLead(partner, { ...generic, kind: "curated" }).assessment.verdict, "ambiguous");
  }
});

test("institutional research collaboration requires trusted affiliation and differs from student and job inquiries", () => {
  const lead = getLead("L02");
  for (const memo of [
    "우리 병원 연구팀에서 공동 연구를 제안합니다.",
    "Our hospital research team proposes a joint research collaboration.",
    "病院の研究チームとして共同研究を提案します。",
  ]) {
    const { assessment } = classifyLead({ ...lead, memo }, evidence([tokyo]));
    assert.equal(assessment.verdict, "partnership-check", memo);
    assert.deepEqual(assessment.handoff, { kind: "regional-sales", region: "APAC" }, memo);
  }

  const collaboration = { ...lead, memo: "Our hospital research team proposes a joint research collaboration." };
  const unverified = classifyLead({ ...collaboration, email: "demo@unverified.example.test" }, evidence([tokyo]));
  assert.equal(unverified.assessment.verdict, "ambiguous");
  assert.equal(classifyLead({ ...collaboration, country: "대한민국" }, evidence([tokyo])).assessment.verdict, "country-check");

  const student = classifyLead({ ...lead, memo: "I am a student asking for specs for my class project." }, evidence([tokyo]));
  assert.equal(student.assessment.verdict, "invalid");
  assert.deepEqual(student.assessment.handoff, { kind: "none" });
  const applicant = classifyLead({ ...lead, memo: "Applying for a research position with interest in joint research." }, evidence([tokyo]));
  assert.equal(applicant.assessment.verdict, "invalid");
  assert.deepEqual(applicant.assessment.handoff, { kind: "hr" });
});

test("two successes without a match differ from partial failure, authentication failure, timeout and stored gaps", async () => {
  const lead = getLead("L03");
  const noMatch = await createAssessmentService({ fetcher: async () => res([]) }).assess(syntheticLead, live);
  assert.equal(noMatch.assessment.verdict, "ambiguous");
  assert.equal(noMatch.assessment.details?.externalStatus, "complete");
  assert.match(noMatch.assessment.reason, /공개 검색에서 기관을 확인하지 못해/u);
  let count = 0;
  const partial = await createAssessmentService({ fetcher: async () => ++count === 1 ? res([cleveland]) : new Response(null, { status: 500 }) }).assess(lead, live);
  assert.equal(partial.assessment.verdict, "ambiguous");
  assert.equal(partial.assessment.details?.externalStatus, "failed");
  assert.deepEqual(partial.assessment.sources, [cleveland.url, "https://my.clevelandclinic.org/about-cleveland-clinic/about-this-website/privacy-security"]);
  const failed = await createAssessmentService({ fetcher: async () => new Response(null, { status: 401 }) }).assess(lead, live);
  assert.equal(failed.assessment.verdict, "ambiguous");
  assert.match(failed.assessment.reason, /외부 확인 실패/);
  const timeout = await createAssessmentService({
    timeoutMs: 5,
    fetcher: async (_url, init) => new Promise((_resolve, reject) => {
      const guard = setTimeout(() => reject(new Error("abort not propagated")), 100);
      init?.signal?.addEventListener("abort", () => { clearTimeout(guard); reject(init.signal?.reason); }, { once: true });
    }),
  }).assess(lead, live);
  assert.equal(timeout.assessment.verdict, "ambiguous");
  assert.equal(timeout.assessment.details?.externalStatus, "failed");
  const noSaved = await createAssessmentService({ fetcher: async () => assert.fail("offline mode must not call upstream") })
    .assess({ ...getLead("L18"), country: "프랑스" }, { mode: "sample", apiKey: "ignored" });
  assert.equal(noSaved.assessment.mode, "saved");
  assert.equal(noSaved.assessment.verdict, "ambiguous");
  assert.equal(noSaved.assessment.details?.externalStatus, "saved-unavailable");
});

test("shared cache merges duplicate requests, isolates different countries, and enforces two upstream calls in flight", async () => {
  const queries: string[] = [];
  let requests = 0;
  let peak = 0;
  const service = createAssessmentService({
    fetcher: async (_url, init) => {
      assert.equal(new Headers(init?.headers).get("x-api-key"), "test-key");
      queries.push(JSON.parse(String(init?.body)).query);
      peak = Math.max(peak, ++requests);
      await new Promise((resolve) => setTimeout(resolve, 5));
      requests -= 1;
      return res([cleveland]);
    },
  });
  const original = getLead("L03");
  const [first, second] = await Promise.all([service.assess(original, live), service.assess(getLead("L29"), live), service.assess(getLead("L12"), live)]);
  assert.equal(peak, 2);
  assert.equal(queries.length, 4, "two different institutions with a duplicated Cleveland lookup");
  assert.ok(queries.includes("Cleveland Clinic United States"));
  assert.ok(queries.some((query) => query.startsWith("Cleveland Clinic hospital")));
  assert.ok(!queries.some((query) => query.includes("@") || query.includes("Replac")));
  assert.equal(first.assessment.mode, "live");
  assert.equal(second.assessment.mode, "saved");
  assert.equal(second.assessment.details?.sourceKind, "cache");
  assert.equal((await service.assess(original, live)).assessment.searchedAt, first.assessment.searchedAt);
  assert.equal(queries.length, 4);
  await service.assess({ ...original, country: "독일" }, live);
  assert.equal(queries.length, 6, "region change invalidates both query keys");
});

test("retry labels a mix of one cached query and one fresh query", async () => {
  let calls = 0;
  const service = createAssessmentService({
    fetcher: async () => ++calls === 2 ? new Response(null, { status: 500 }) : res([cleveland]),
  });
  assert.equal((await service.assess(getLead("L03"), live)).assessment.details?.externalStatus, "failed");
  const resumed = await service.assess(getLead("L03"), live);
  assert.equal(calls, 3);
  assert.equal(resumed.assessment.details?.sourceKind, "mixed");
  assert.equal(resumed.assessment.details?.externalStatus, "complete");
  assert.equal(resumed.assessment.verdict, "valid");
});

test("one lead can complete while another still has an unfinished query", async () => {
  let release: (() => void) | undefined;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  const service = createAssessmentService({
    fetcher: async (_url, init) => {
      const query = (JSON.parse(String(init?.body)) as { query: string }).query;
      if (query === "Cleveland Clinic United States") await pending;
      return res(query.startsWith("Cleveland Clinic") ? [cleveland] : [charite]);
    },
  });
  let slowDone = false;
  const slow = service.assess(getLead("L03"), live).then((result) => { slowDone = true; return result; });
  try {
    assert.equal((await service.assess(getLead("L12"), live)).assessment.verdict, "country-check");
    assert.equal(slowDone, false);
  } finally {
    release?.();
  }
  assert.equal((await slow).assessment.verdict, "valid");
});

test("rate limiting honors Retry-After once and leaves long delays for manual retry", async () => {
  let clock = Date.parse(at);
  const seen = new Map<string, number[]>();
  const service = createAssessmentService({
    now: () => clock,
    delay: async (ms) => { clock += ms; },
    fetcher: async (_url, init) => {
      const query = (JSON.parse(String(init?.body)) as { query: string }).query;
      const prior = seen.get(query) ?? [];
      seen.set(query, [...prior, clock]);
      return query.includes("United States") && prior.length === 0
        ? new Response(null, { status: 429, headers: { "Retry-After": "2" } }) : res([cleveland]);
    },
  });
  assert.equal((await service.assess(getLead("L03"), live)).assessment.verdict, "valid");
  assert.deepEqual(seen.get("Cleveland Clinic United States"), [Date.parse(at), Date.parse(at) + 2000]);
  let hits = 0;
  const limited = createAssessmentService({
    delay: async () => assert.fail("large Retry-After should not block"),
    fetcher: async () => { hits += 1; return new Response(null, { status: 429, headers: { "Retry-After": "60" } }); },
  });
  assert.equal((await limited.assess(getLead("L03"), live)).assessment.verdict, "ambiguous");
  assert.equal(hits, 2, "long Retry-After is not retried");
  await limited.assess(getLead("L12"), live);
  assert.equal(hits, 2, "subsequent work respects the shared cooldown");
});

test("stored Liner non-matches only replay the reviewed institution and country combinations", async () => {
  let calls = 0;
  const service = createAssessmentService({
    now: () => Date.parse("2026-11-21T00:00:00Z"),
    fetcher: async () => { calls++; return res([]); },
  });
  for (const id of ["L17", "L18", "L19", "L20", "L27"]) {
    const lead = getLead(id);
    const { assessment } = await service.assess(lead, { mode: "sample", apiKey: "test-key" });
    assert.equal(assessment.verdict, "invalid", id);
    assert.equal(assessment.reason, "공개 정보에서 기관을 찾지 못함", id);
    assert.equal(assessment.mode, "saved", id);
    assert.equal(assessment.details?.sourceKind, "curated", id);
    assert.equal(assessment.details?.externalStatus, "complete", id);
    assert.ok(assessment.searchedAt?.startsWith("2026-11-18T19:5"), id);
    assert.deepEqual(assessment.sources, [], id);

    const changedCountry = await service.assess({ ...lead, country: "프랑스" }, { mode: "sample" });
    assert.equal(changedCountry.assessment.verdict, "ambiguous", id);
    assert.equal(changedCountry.assessment.details?.externalStatus, "saved-unavailable", id);
  }
  assert.equal(calls, 0);
});

test("assessment route accepts seed IDs only and its response survives store hydration", async () => {
  const previous = process.env.LINER_MODE;
  process.env.LINER_MODE = "sample";
  try {
    assert.equal((await POST(request({ leadId: "L01" }, "text/plain"))).status, 415);
    assert.equal((await POST(request({ leadId: "L01", query: "unapproved" }))).status, 400);
    assert.equal((await POST(request({ leadId: "L01", country: "unknown" }))).status, 400);
    assert.equal((await POST(request({ leadId: "L00" }))).status, 404);
    const missingInstitution = await (await POST(request({ leadId: "L15" }))).json();
    assert.equal(missingInstitution.assessment.verdict, "invalid");
    assert.equal(missingInstitution.assessment.details.externalStatus, "not-needed");
    const response = await POST(request({ leadId: "L12", country: "독일" }));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    const { leadId, assessment, workflow } = await response.json();
    assert.equal(assessment.verdict, "valid");
    assert.equal(assessment.mode, "saved");
    assert.equal(assessment.details.sourceKind, "curated");
    assert.deepEqual(assessment.handoff, { kind: "dealer", dealerId: "dealer-e" });
    const storage = new Map<string, string>();
    const storeAdapter = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => { storage.set(key, value); },
      removeItem: (key: string) => { storage.delete(key); },
    };
    assert.equal(createForwardingStore(storeAdapter).append({ type: "assessed", id: "assessment-1", at, leadId, assessment, workflow }).ok, true);
    assert.deepEqual(createForwardingStore(storeAdapter).hydrate().state.leadStates.L12.assessment, assessment);
  } finally {
    if (previous === undefined) delete process.env.LINER_MODE;
    else process.env.LINER_MODE = previous;
  }
});
