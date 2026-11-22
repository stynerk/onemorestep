import assert from "node:assert/strict";
import test from "node:test";
import { buildDirectionQuestionRequest, directionQuestionFingerprint, formulateDirectionQuestion, parseDirectionQuestionResponse } from "../src/lib/forwarding/direction-question-router";
import { getDirectionQuestion, getRecordedDirectionWording } from "../src/lib/forwarding/direction-questions";
import recordedQuestions from "../src/lib/forwarding/saved-direction-questions.json";
import type { Assessment, AssessmentDetails, LeadInput } from "../src/lib/forwarding/types";

const lead: LeadInput = {
  id: "fixture-lead", name: "Demo Name", institution: "Fixture Institute", email: "contact@department.fixture.org",
  phone: "DEMO-NOT-A-PHONE", country: "독일", product: "PM-50", memo: "Demo memo only", receivedAt: "2026-11-22T00:00:00.000Z",
};
const assessment = (overrides: Partial<AssessmentDetails> = {}): Assessment => ({
  verdict: "ambiguous", reason: "확인 필요", sources: ["https://fixture.org/"], mode: "saved", searchedAt: lead.receivedAt,
  details: { domain: "unverified", countries: [], industry: null, memoIntent: "buying", memoQuote: null,
    externalStatus: "complete", sourceKind: "cache", ...overrides },
});
const response = (question: string, summary: string) => ({
  choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ question, summary }) } }],
});

test("direction questions identify one missing fact and keep actions fixed", () => {
  const domain = getDirectionQuestion(lead, assessment());
  assert.equal(domain.kind, "domain");
  assert.match(domain.question, /department\.fixture\.org.*Fixture Institute/u);
  assert.deepEqual(domain.choices.map(({ value }) => value), ["yes", "no", "unknown"]);
  assert.equal(getDirectionQuestion(lead, assessment({ domain: "matched", countries: ["독일"] })).kind, "intent");
  const location = getDirectionQuestion(lead, assessment({ domain: "matched" }));
  assert.equal(location.kind, "location");
  assert.deepEqual(location.choices.map(({ value }) => value), ["yes", "other-country", "unknown"]);
  const testingAddress = { ...lead, email: "contact@fixture.test" };
  assert.equal(getDirectionQuestion(testingAddress, assessment({ domain: "suspicious" })).kind, "spoof");
  assert.equal(getDirectionQuestion(testingAddress, assessment()).kind, "evidence");
  assert.equal(getDirectionQuestion(testingAddress, assessment({ domain: "matched" })).kind, "location");
  assert.equal(getDirectionQuestion(lead, assessment({ domain: "free-email" })).choices.length, 1);
  assert.equal(getDirectionQuestion(lead, assessment({ domain: "suspicious", externalStatus: "failed" })).kind, "evidence");
  assert.equal(getDirectionQuestion(lead, { ...assessment(), sources: [] }).kind, "evidence");
});

test("Router can word questions using only placeholders and falls back on a malformed reply", async () => {
  const wording = { question: "{{domain}} 주소를 {{institution}}에서 사용하나요?", summary: "{{evidence}}." };
  const fetcher: typeof fetch = async (_input, init) => {
    assert.equal(init?.method, "POST");
    assert.deepEqual(JSON.parse(String(init?.body)), buildDirectionQuestionRequest("domain"));
    for (const field of [lead.institution, lead.email, lead.phone, lead.memo, lead.name]) assert.ok(!String(init?.body).includes(field));
    return Response.json(response(wording.question, wording.summary));
  };
  assert.deepEqual(await formulateDirectionQuestion(lead, assessment(), { publicDemo: false, mode: "live", apiKey: "fixture-key", fetcher }), {
    question: "department.fixture.org 주소를 Fixture Institute에서 사용하나요?", summary: "아래 공개 출처를 검토했어요.",
  });
  assert.equal(parseDirectionQuestionResponse(response("{{domain}} 주소를 사용하나요?", wording.summary), "domain"), null);
  assert.equal(parseDirectionQuestionResponse(response(wording.question, "{{evidence}}. 별도 확인을 마쳤어요."), "domain"), null);
  assert.equal(parseDirectionQuestionResponse(response(wording.question + " 추가 질문인가요?", wording.summary), "domain"), null);
  assert.equal(await formulateDirectionQuestion(lead, assessment(), {
    publicDemo: false, mode: "live", apiKey: "fixture-key", fetcher: async () => { throw new Error("fixture timeout"); },
  }), null);
});

test("public demo replays recorded wording for its question types without making a request", async () => {
  const fetcher: typeof fetch = async () => { assert.fail("public demo made a Router request"); };
  const settings = { publicDemo: true, mode: "live", apiKey: "fixture-key", fetcher };
  for (const details of [
    { domain: "free-email" }, { domain: "matched", countries: ["독일"] }, { domain: "suspicious" }, { domain: "matched" }, { domain: "unverified" },
  ] satisfies Partial<AssessmentDetails>[]) {
    const current = assessment(details);
    const wording = await formulateDirectionQuestion(lead, current, settings);
    assert.ok(wording);
    const fallback = getDirectionQuestion(lead, current);
    assert.equal(recordedQuestions[fallback.kind].fingerprint, directionQuestionFingerprint(fallback.kind));
    assert.deepEqual(getRecordedDirectionWording(lead, current), wording);
    assert.equal(getRecordedDirectionWording(lead, current, "outdated-prompt-fingerprint"), null);
    assert.notEqual(wording.question, fallback.question);
    assert.equal(wording.summary, fallback.summary);
    assert.doesNotMatch(wording.question, /\{\{/u);
  }
  assert.equal(await formulateDirectionQuestion(lead, { ...assessment(), verdict: "invalid" }, settings), null);
});
