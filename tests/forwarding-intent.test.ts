import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { POST } from "../src/app/api/forwarding/assess/route";
import {
  buildInquiryIntentRequest, lookupSavedInquiryIntent, parseInquiryIntentResponse, requestInquiryIntent,
} from "../src/lib/forwarding/intent-router";
import { createInitialForwardingState } from "../src/lib/forwarding/seed";
import { createForwardingStore } from "../src/lib/forwarding/store";
import type { InquiryIntent, LeadInput } from "../src/lib/forwarding/types";
import { classifyLead } from "../src/lib/forwarding/verdict";

const at = "2026-11-19T12:00:00.000Z";
const memo = "Guten Tag. Ich möchte mich auf die ausgeschriebene Stelle bewerben.";
const advice = { intent: "job", quote: "die ausgeschriebene Stelle bewerben." } as const;
const routerEnvelope = (content: unknown, finish_reason = "stop") => ({
  choices: [{ finish_reason, message: { content: JSON.stringify(content) } }],
});
const endpoint = "https://platform.liner.com/api/v1/chat/completions";

test("Router POST sends only the memo with the fixed model and strict output schema", async () => {
  let requests = 0;
  const result = await requestInquiryIntent(memo, {
    apiKey: "test-only",
    fetcher: async (url, init) => {
      requests += 1;
      assert.equal(url, endpoint);
      assert.equal(init?.method, "POST");
      assert.equal(init?.redirect, "error");
      assert.equal(init?.cache, "no-store");
      assert.ok(init?.signal instanceof AbortSignal);
      assert.deepEqual(new Headers(init.headers).get("authorization"), "Bearer test-only");
      const body = JSON.parse(String(init.body));
      assert.deepEqual(body, buildInquiryIntentRequest(memo));
      assert.equal(body.model, "liner-gpt-router");
      assert.equal(body.reasoning_effort, "none");
      assert.equal(body.max_completion_tokens, 140);
      assert.deepEqual(body.messages.map((message: { role: string }) => message.role), ["system", "user"]);
      assert.deepEqual(JSON.parse(body.messages[1].content), { memo });
      assert.equal(Object.hasOwn(body, "tools"), false);
      assert.deepEqual(body.response_format, {
        type: "json_schema",
        json_schema: {
          name: "inquiry_intent", strict: true,
          schema: {
            type: "object",
            properties: {
              intent: { type: "string", enum: ["buying", "partnership", "job", "student", "sales", "spam", "unknown"] },
              quote: { type: "string" },
            },
            required: ["intent", "quote"], additionalProperties: false,
          },
        },
      });
      return Response.json(routerEnvelope(advice));
    },
  });
  assert.equal(requests, 1);
  assert.deepEqual(result, advice);
});

test("the strict parser and saved replay require a short verbatim memo excerpt", () => {
  assert.deepEqual(parseInquiryIntentResponse(routerEnvelope(advice), memo), advice);
  for (const response of [
    routerEnvelope({ ...advice, quote: advice.quote.toUpperCase() }),
    routerEnvelope({ ...advice, quote: "die ausgeschriebene bewerben." }),
    routerEnvelope({ ...advice, quote: " " }),
    routerEnvelope({ ...advice, quote: "x".repeat(201) }),
    routerEnvelope({ ...advice, verdict: "valid" }),
    routerEnvelope({ ...advice, intent: "unsupported" }),
    routerEnvelope({ intent: "job" }),
    routerEnvelope(advice, "length"),
    { choices: [{ finish_reason: "stop", message: { content: "{invalid" } }] },
    { choices: [{ finish_reason: "stop", message: { content: JSON.stringify(advice), refusal: "refused" } }] },
    { choices: [{ finish_reason: "stop", message: { content: JSON.stringify(advice), tool_calls: [{}] } }] },
  ]) {
    assert.equal(parseInquiryIntentResponse(response, "x".repeat(201) + memo), null);
  }

  const key = createHash("sha256").update(memo, "utf8").digest("hex");
  const saved = { [key]: advice };
  assert.deepEqual(lookupSavedInquiryIntent(memo, saved), advice);
  assert.equal(lookupSavedInquiryIntent(memo + " ", saved), null);
  assert.equal(lookupSavedInquiryIntent(memo, Object.create(saved)), null);
  assert.equal(lookupSavedInquiryIntent(memo, { [key]: { ...advice, quote: "wrong" } }), null);
});

test("Router status, connection, parse and timeout failures use the rule fallback", async () => {
  let aborted = false;
  const failures: (typeof fetch)[] = [
    async () => new Response(null, { status: 401 }),
    async () => new Response(null, { status: 429 }),
    async () => { throw new Error("Network unavailable"); },
    async () => new Response("invalid JSON"),
    async (_url, init) => new Promise((_resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Expected request abort")), 100);
      init?.signal?.addEventListener("abort", () => {
        clearTimeout(timer);
        aborted = true;
        reject(init.signal?.reason);
      }, { once: true });
    }),
  ];
  for (const fetcher of failures) {
    assert.equal(await requestInquiryIntent(memo, { fetcher, apiKey: "test-only", timeoutMs: 10 }), null);
  }
  assert.equal(aborted, true);
  let skippedCalls = 0;
  const fetcher = async () => {
    skippedCalls += 1;
    return Response.json(routerEnvelope(advice));
  };
  assert.equal(await requestInquiryIntent(memo, { fetcher }), null);
  assert.equal(await requestInquiryIntent(" ", { apiKey: "test-only", fetcher }), null);
  assert.equal(skippedCalls, 0);
});

const lead: LeadInput = {
  id: "intent-test", institution: "Harborleaf Research Lab", name: "Synthetic", email: "synthetic@harborleaf.org", phone: "",
  country: "미국", product: "PM-50", memo, receivedAt: at,
};
const source = {
  title: lead.institution, url: "https://harborleaf.org/contact", description: "The lab's headquarters address is in Cleveland, Ohio, United States.",
};
const complete = { sources: [source], searchedAt: at, kind: "liner" as const, status: "complete" as const };

test("validated intent resolves ambiguous memos without bypassing institution rules or making a lead valid", () => {
  const baseline = classifyLead(lead, complete).assessment;
  assert.equal(baseline.verdict, "ambiguous");
  const job = classifyLead(lead, complete, lead.country, advice).assessment;
  assert.equal(job.verdict, "invalid");
  assert.deepEqual(job.handoff, { kind: "hr" });
  assert.deepEqual(job.details, { ...baseline.details, memoIntent: "job", memoQuote: advice.quote, memoSource: "liner" });

  const studentLead = { ...lead, memo: "I need pricing figures for the report I am writing for my course." };
  const missing = { ...complete, sources: [], kind: "cache" as const, status: "saved-unavailable" as const };
  const student = classifyLead(studentLead, missing, lead.country, { intent: "student", quote: "the report I am writing for my course." });
  assert.equal(student.assessment.verdict, "invalid");
  assert.deepEqual(student.assessment.handoff, { kind: "none" });
  assert.equal(student.assessment.details?.externalStatus, "saved-unavailable");
  const failed = classifyLead(lead, { ...complete, status: "failed" }, lead.country, advice);
  assert.equal(failed.assessment.details?.externalStatus, "failed");

  const potentialBuyer = { ...lead, memo: "We would like to get 24 units." };
  const fallback = classifyLead(potentialBuyer, complete);
  assert.equal(fallback.assessment.verdict, "ambiguous");
  assert.deepEqual(classifyLead(potentialBuyer, complete, lead.country, { intent: "buying", quote: "get 24 units" }), fallback);
  assert.deepEqual(classifyLead(lead, complete, lead.country, { ...advice, quote: "not in the memo" }).assessment, baseline);
});

test("AI disagreement preserves existing valid, country-check, fraudulent and fictional routes", () => {
  const buyer = { ...lead, memo: "Can you send a quote for 24 units?" };
  const confirmed = classifyLead(buyer, complete);
  assert.equal(confirmed.assessment.verdict, "valid");
  for (const intent of ["job", "student", "sales", "spam", "unknown"] as const) {
    assert.deepEqual(classifyLead(buyer, complete, lead.country, { intent, quote: "24 units" }), confirmed);
  }
  const agreed = classifyLead(buyer, complete, lead.country, { intent: "buying", quote: buyer.memo });
  assert.equal(agreed.assessment.verdict, "valid");
  assert.equal(agreed.assessment.details?.memoSource, "liner");
  assert.equal(agreed.assessment.details?.memoQuote, buyer.memo);

  const wrongCountry = { ...buyer, country: "독일" };
  const countryResult = classifyLead(wrongCountry, complete);
  assert.equal(countryResult.assessment.verdict, "country-check");
  assert.deepEqual(classifyLead(wrongCountry, complete, wrongCountry.country, { intent: "student", quote: "24 units" }), countryResult);

  const impersonation = { ...lead, email: "synthetic@harborleaf.test" };
  const suspect = classifyLead(impersonation, complete);
  assert.equal(suspect.assessment.verdict, "ambiguous");
  assert.equal(suspect.assessment.details?.domain, "suspicious");
  assert.deepEqual(classifyLead(impersonation, complete, lead.country, advice), suspect);
  const fake = { ...lead, institution: "Synthetic Fictional Lab", email: "person@fictional.test" };
  const empty = { ...complete, sources: [] };
  const invalid = classifyLead(fake, empty);
  assert.equal(invalid.assessment.verdict, "invalid");
  assert.deepEqual(classifyLead(fake, empty, fake.country, advice), invalid);

  const spamLead = { ...lead, memo: "A promotion with guaranteed investment returns." };
  const spam = classifyLead(spamLead, complete);
  assert.equal(spam.assessment.verdict, "invalid");
  assert.equal(spam.assessment.reason, "스팸성 홍보 문의로 확인됐어요.");
  assert.equal(spam.assessment.details?.memoIntent, "unknown");
  assert.equal(spam.assessment.details?.memoQuote, null);

  const promotional = { ...lead, memo: "Junk message: reply at once for a shady promotion." };
  const modelSpam = classifyLead(promotional, complete, lead.country, { intent: "spam", quote: "a shady promotion" });
  assert.equal(modelSpam.assessment.verdict, "invalid");
  assert.equal(modelSpam.assessment.details?.memoIntent, "spam");
  assert.equal(modelSpam.assessment.details?.memoSource, "liner");
});

test("the assessment route replays public intent and only calls the Router in configured live mode", async (t) => {
  const settings = new Map(["MIRINAE_DEMO_TARGET", "VERCEL", "LINER_MODE", "LINER_API_KEY"].map((key) => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  t.after(() => {
    for (const [key, value] of settings) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    globalThis.fetch = originalFetch;
  });

  process.env.VERCEL = "0";
  process.env.MIRINAE_DEMO_TARGET = "public";
  process.env.LINER_MODE = "live";
  process.env.LINER_API_KEY = "test-only";
  const seed = createInitialForwardingState().leads.find(({ id }) => id === "L03")!;
  const sent: string[] = [];
  globalThis.fetch = async (url, init) => {
    sent.push(String(url));
    if (url === endpoint) {
      const body = JSON.parse(String(init?.body));
      assert.deepEqual(JSON.parse(body.messages[1].content), { memo: seed.memo });
      return Response.json(routerEnvelope({ intent: "buying", quote: seed.memo } satisfies InquiryIntent));
    }
    assert.equal(url, "https://platform.liner.com/api/v1/tools/search/web");
    return Response.json({ results: [{
      title: "Cleveland Clinic", url: "https://my.clevelandclinic.org/locations", description: "Headquarters address in Cleveland, Ohio, United States.",
    }] });
  };

  const request = () => new Request("http://127.0.0.1/api/forwarding/assess", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadId: seed.id }),
  });
  const stored = await POST(request());
  assert.equal(stored.status, 200);
  const publicResult = await stored.json();
  assert.equal(publicResult.assessment.details.memoSource, "liner");
  assert.equal(publicResult.assessment.details.memoIntent, "buying");
  assert.ok(publicResult.assessment.details.memoQuote.trim());
  assert.ok(seed.memo.includes(publicResult.assessment.details.memoQuote));
  assert.deepEqual(sent, []);

  process.env.MIRINAE_DEMO_TARGET = "local";
  process.env.LINER_MODE = "sample";
  const local = await POST(request());
  assert.equal(local.status, 200);
  assert.equal((await local.json()).assessment.details.memoSource, undefined);
  assert.deepEqual(sent, []);

  process.env.LINER_MODE = "live";
  const live = await POST(request());
  assert.equal(live.status, 200);
  assert.equal(sent.filter((url) => url === endpoint).length, 1);
  assert.equal(sent.filter((url) => url !== endpoint).length, 2);
  const outcome = await live.json();
  assert.equal(outcome.assessment.verdict, "valid");
  assert.equal(outcome.assessment.details.memoSource, "liner");
  assert.equal(outcome.assessment.details.memoQuote, seed.memo);

  const values = new Map<string, string>();
  const storage = {
    getItem(key: string) { return values.get(key) ?? null; },
    setItem(key: string, value: string) { values.set(key, value); },
    removeItem(key: string) { values.delete(key); },
  };
  const store = createForwardingStore(storage);
  assert.equal(store.append({ id: "router-intent", type: "assessed", at, ...outcome }).ok, true);
  const restored = createForwardingStore(storage).hydrate();
  assert.equal(restored.ok, true);
  assert.equal(restored.state.leadStates[seed.id].assessment?.details?.memoSource, "liner");
});
