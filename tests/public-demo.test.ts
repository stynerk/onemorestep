import assert from "node:assert/strict";
import { test } from "node:test";
import { POST as assess } from "../src/app/api/forwarding/assess/route";
import { POST as mail } from "../src/app/api/forwarding/mail/route";
import { POST as research } from "../src/app/api/research/route";
import { getSavedIndustry } from "../src/lib/forwarding/industry-demo.server";

test("public build and Vercel runtime both enforce stored assessment and block mail despite private settings", async (t) => {
  const keys = ["MIRINAE_DEMO_TARGET", "VERCEL", "LINER_MODE", "LINER_API_KEY", "TEST_MAIL_TO", "MAIL_FROM", "GMAIL_APP_PASSWORD"];
  const previous = new Map(keys.map((key) => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  t.after(() => {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    globalThis.fetch = originalFetch;
  });

  process.env.LINER_MODE = "live";
  process.env.LINER_API_KEY = "synthetic-liner-test-key";
  process.env.TEST_MAIL_TO = "inbox@example.test";
  process.env.MAIL_FROM = "sender@example.test";
  process.env.GMAIL_APP_PASSWORD = "synthetic-mail-test-key";
  let upstreamCalls = 0;
  globalThis.fetch = async () => {
    upstreamCalls += 1;
    throw new Error("Unexpected upstream request");
  };

  const origin = "https://public-demo.example.test";
  const post = (path: string, body: unknown) => new Request(origin + path, {
    method: "POST", headers: { "Content-Type": "application/json", origin }, body: JSON.stringify(body),
  });

  for (const [target, platform] of [["public", "0"], ["local", "1"]]) {
    process.env.MIRINAE_DEMO_TARGET = target;
    process.env.VERCEL = platform;
    const leadResponse = await assess(post("/api/forwarding/assess", { leadId: "L03" }));
    assert.equal(leadResponse.status, 200);
    const { assessment } = await leadResponse.json();
    assert.equal(assessment.mode, "saved");
    assert.equal(assessment.details.sourceKind, "curated");
    const explicitDefault = await assess(post("/api/forwarding/assess", { leadId: "L03", industry: "medicom" }));
    assert.equal(explicitDefault.status, 200);
    assert.equal((await explicitDefault.json()).assessment.verdict, assessment.verdict);
    assert.equal((await assess(post("/api/forwarding/assess", { leadId: "L03", industry: "__proto__" }))).status, 404);
    assert.equal((await assess(post("/api/forwarding/assess", { leadId: "L03", industry: [] }))).status, 400);
    if (!getSavedIndustry("b2b-saas")) {
      assert.equal((await assess(post("/api/forwarding/assess", { leadId: "L03", industry: "b2b-saas" }))).status, 404);
    }

    const researchResponse = await research(post("/api/research", { query: "공개 자료" }));
    assert.equal(researchResponse.status, 200);
    assert.equal((await researchResponse.json()).mode, "sample");

    let mailBodyRead = false;
    const mailRequest = post("/api/forwarding/mail", {
      event: { id: "approval-demo", leadId: "L03", at: "2026-11-19T09:00:00.000Z", type: "decision",
        action: "approve", dealerId: "dealer-v", reason: "시연 승인" },
    });
    mailRequest.text = async () => {
      mailBodyRead = true;
      throw new Error("Unexpected mail body read");
    };
    const blocked = await mail(mailRequest);
    assert.equal(blocked.status, 403);
    assert.equal(blocked.headers.get("cache-control"), "no-store");
    assert.equal((await blocked.json()).code, "public-demo");
    assert.equal(mailBodyRead, false);
  }
  process.env.MIRINAE_DEMO_TARGET = "local";
  process.env.VERCEL = "0";
  assert.equal((await assess(post("/api/forwarding/assess", { leadId: "L03", industry: "b2b-saas" }))).status, 404);
  assert.equal(upstreamCalls, 0);
});
