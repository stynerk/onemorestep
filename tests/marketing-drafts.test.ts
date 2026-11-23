import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "../src/app/api/marketing/draft/route";
import { marketingReviewWarnings } from "../src/lib/marketing/draft";
import { getMarketingDraft } from "../src/lib/marketing/marketing-drafts.server";
import { marketingChannels, rankedMarketingRequests } from "../src/lib/marketing/policy";

test("marketing scores and repeat groups match the approved eight-case table", () => {
  const order = rankedMarketingRequests.map(({ id, score }) => [id, score]);
  assert.deepEqual(order, [["M01", 86], ["M04", 61], ["M06", 53], ["M02", 50], ["M05", 40], ["M07", 28], ["M03", 24], ["M08", 23]]);
  assert.deepEqual(rankedMarketingRequests[0].reasons.map(({ points }) => points), [40, 30, 16, 0]);
  assert.deepEqual(rankedMarketingRequests.find(({ id }) => id === "M03")?.repeats, ["M07"]);
  assert.deepEqual(rankedMarketingRequests.find(({ id }) => id === "M07")?.repeats, ["M03"]);
});

test("public marketing serves all 40 recorded drafts without external calls and includes M01 guidance", async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => {
    calls += 1;
    throw new Error("Public requests must not call Liner");
  };
  for (const request of rankedMarketingRequests) {
    for (const { id } of marketingChannels) {
      const draft = await getMarketingDraft(request.id, id, { publicDemo: true, mode: "live", apiKey: "mock", fetcher });
      assert.equal(draft.mode, "recorded", request.id + "/" + id);
      assert.ok(draft.sources[0].excerpt, request.id + "/" + id);
      assert.ok(draft.titleNeedsVerification, request.id + "/" + id);
      if (request.id === "M01") {
        assert.ok(draft.sources.some(({ url }) => new URL(url).hostname === "eur-lex.europa.eu"), id);
        assert.ok(draft.warnings.some((warning) => warning.includes("안전 단정")), id);
      }
    }
  }
  assert.equal(calls, 0);
});

test("live marketing calls Search before Router and only links a matching evidence excerpt", async () => {
  const calls: string[] = [];
  const quote = "This public guidance describes medical device labeling.";
  const url = "https://agency.example/labeling";
  const fetcher: typeof fetch = async (input, options) => {
    const path = new URL(String(input)).pathname;
    calls.push(path);
    if (path.endsWith("/search/web")) {
      return Response.json({ results: [{ title: "Public guidance", url, description: quote }] });
    }
    const request = JSON.parse(String(options?.body));
    assert.equal(request.model, "liner-gpt-router");
    assert.equal(request.response_format.type, "json_schema");
    return Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({
      drafts: [{
        channel: "linkedin", title: "입찰용 검토 초안", extra: "", tags: ["#검토"],
        lines: [
          { text: quote, sourceIndex: 1 },
          { text: "함께 사용하면 안전합니다.", sourceIndex: 1 },
          { text: "전년 대비 15% 개선됐습니다.", sourceIndex: null },
          { text: "타사 대비 더 우수합니다.", sourceIndex: null },
        ],
      }],
    }) } }] });
  };
  const result = await getMarketingDraft("M01", "linkedin", { mode: "live", apiKey: "mock", fetcher });
  assert.deepEqual(calls, ["/api/v1/tools/search/web", "/api/v1/chat/completions"]);
  assert.equal(result.mode, "live");
  assert.deepEqual(result.lines[0], { text: quote, sourceUrl: url, needsVerification: false });
  assert.deepEqual(result.lines[1], { text: "함께 사용하면 안전합니다.", needsVerification: true });
  assert.ok(result.lines[2].needsVerification);
  assert.ok(result.warnings.some((warning) => warning.includes("효능·안전 단정")));
  assert.ok(result.warnings.some((warning) => warning.includes("근거 없는 수치")));
  assert.ok(result.warnings.some((warning) => warning.includes("비교 우위")));
});

test("source links require a full title, description, or complete sentence without dropped negation", async () => {
  const title = "Guidance for adult patients";
  const sentence = "Review the public guidance before use.";
  const incomplete = "The boundaries of this source could";
  const url = "https://agency.example/labeling";
  const fetcher: typeof fetch = async (input) => {
    if (new URL(String(input)).pathname.endsWith("/search/web")) {
      return Response.json({ results: [{ title, url, description: "Not\nSafe in adult patients. " + sentence + " " + incomplete }] });
    }
    const lines = [title, sentence, "Safe in adult patients.", incomplete].map((text) => ({ text, sourceIndex: 1 }));
    return Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({
      drafts: [{ channel: "linkedin", title, extra: "", tags: [], lines }],
    }) } }] });
  };
  const result = await getMarketingDraft("M01", "linkedin", { mode: "live", apiKey: "mock", fetcher });
  assert.deepEqual(result.lines.map(({ needsVerification, sourceUrl }) => [needsVerification, sourceUrl]), [
    [false, url], [false, url], [true, undefined], [true, undefined],
  ]);
});

test("marketing warning review catches simple claims in both supported draft languages", () => {
  for (const text of ["안전합니다.", "효과적입니다.", "효과가 있습니다.", "완전히 안전합니다.", "Safe and effective in all patients."]) {
    assert.ok(marketingReviewWarnings(text, []).some((warning) => warning.includes("효능·안전 단정")), text);
  }
  assert.ok(marketingReviewWarnings("", [{ text: "환자 30명 개선" }]).some((warning) => warning.includes("근거 없는 수치")));
});

test("marketing draft safely falls back on unavailable search or invalid routing output", async () => {
  const unavailable = await getMarketingDraft("M04", "blog", { mode: "live", apiKey: "mock", fetcher: async () => new Response(null, { status: 429 }) });
  assert.equal(unavailable.mode, "template");
  const malformed = await getMarketingDraft("M04", "blog", {
    mode: "live", apiKey: "mock",
    fetcher: async (input) => String(input).endsWith("/search/web") ? Response.json({ results: [] }) : Response.json({ choices: [] }),
  });
  assert.equal(malformed.mode, "template");
  assert.equal(malformed.lines.length, 4);
});

test("marketing route rejects oversized or unsupported requests", async () => {
  function request(payload: unknown, json = true) {
    return new Request("http://localhost/api/marketing/draft", {
      method: "POST", headers: { "Content-Type": json ? "application/json" : "text/plain" }, body: JSON.stringify(payload),
    });
  }
  assert.equal((await POST(request({ requestId: "M01", channel: "linkedin" }, false))).status, 415);
  assert.equal((await POST(request({ requestId: "M09", channel: "linkedin" }))).status, 400);
  assert.equal((await POST(request({ requestId: "M01", channel: "linkedin", data: "a".repeat(1024) }))).status, 400);
});
