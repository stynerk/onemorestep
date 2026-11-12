import assert from "node:assert/strict";
import { test } from "node:test";
import { research } from "../src/lib/research";
import { POST } from "../src/app/api/research/route";

const source = { title: "공식 문서", url: "https://liner.com/developers/docs", description: "공개 문서" };
const neverFetch: typeof fetch = async () => { throw new Error("must not call upstream"); };

test("sample mode and missing keys never call a paid API", async () => {
  for (const options of [{}, { mode: "live" }, { mode: "sample", apiKey: "test-key" }]) {
    const result = await research("전혀 다른 질의", { ...options, fetcher: neverFetch });
    assert.equal(result.mode, "sample");
    assert.match(result.notice, /실제 검색 결과가 아닙니다/);
    assert.notEqual(result.query, result.sampleQuery);
    assert.equal(result.sources.length, 2);
  }
});

test("live query uses official request schema and only returns source fields", async () => {
  const fetcher: typeof fetch = async (url, init) => {
    assert.equal(url, "https://platform.liner.com/api/v1/tools/search/web");
    assert.equal(new Headers(init?.headers).get("x-api-key"), "test-key");
    assert.deepEqual(JSON.parse(String(init?.body)), {
      query: "공개 자료", lang: "ko", country_code: "kr", max_results: 3, include_knowledge: false,
    });
    return Response.json({ results: [{ ...source, providerInternal: "hidden" }] });
  };
  const result = await research(" 공개 자료 ", { mode: "live", apiKey: "test-key", fetcher });
  assert.equal(result.mode, "live");
  assert.deepEqual(result.sources, [source]);
  assert.doesNotMatch(JSON.stringify(result), /test-key|providerInternal/);
});

test("authentication, credits, rate limits, and upstream errors degrade to labeled examples", async () => {
  for (const status of [401, 402, 429, 500, 502]) {
    let calls = 0;
    const result = await research("공개 자료", {
      mode: "live", apiKey: "test-key", fetcher: async () => {
        calls++;
        return new Response("private upstream details", { status });
      },
    });
    assert.equal(calls, 1);
    assert.equal(result.mode, "sample");
    assert.doesNotMatch(JSON.stringify(result), /private upstream|test-key/);
  }
});

test("network errors, malformed responses, unsafe links, and timeouts preserve an example", async () => {
  const fetchers: (typeof fetch)[] = [
    async () => { throw new Error("network error containing secret"); },
    async () => new Response("not json"),
    async () => Response.json({ unexpected: true }),
    async () => Response.json({ results: [{ ...source, url: "javascript:alert(1)" }] }),
    async (_url, init) => new Promise((_resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("test guard")), 500);
      init?.signal?.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(init.signal?.reason);
      }, { once: true });
    }),
  ];
  for (const fetcher of fetchers) {
    const result = await research("공개 자료", { mode: "live", apiKey: "test-key", timeoutMs: 10, fetcher });
    assert.equal(result.mode, "sample");
    assert.ok(result.sources.length > 0);
    assert.doesNotMatch(JSON.stringify(result), /test-key|containing secret|javascript:/);
  }
});

test("empty live results remain live and invalid queries do not call upstream", async () => {
  const result = await research("공개 자료", {
    mode: "live", apiKey: "test-key", fetcher: async () => Response.json({ results: [] }),
  });
  assert.equal(result.mode, "live");
  assert.deepEqual(result.sources, []);
  for (const query of ["", " ", "a", "a".repeat(301)]) {
    await assert.rejects(research(query, { fetcher: neverFetch }));
  }
});

test("HTTP endpoint rejects invalid JSON and query shapes", async () => {
  for (const body of ["{", "null", "{}", '{"query":1}', '{"query":" "}']) {
    const response = await POST(new Request("http://localhost/api/research", { method: "POST", body }));
    assert.equal(response.status, 400);
  }
});

test("HTTP endpoint returns no-store sample without credentials", async () => {
  const beforeMode = process.env.LINER_MODE;
  try {
    process.env.LINER_MODE = "sample";
    const response = await POST(new Request("http://localhost/api/research", {
      method: "POST", body: JSON.stringify({ query: "공개 자료" }),
    }));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal((await response.json()).mode, "sample");
  } finally {
    if (beforeMode === undefined) delete process.env.LINER_MODE;
    else process.env.LINER_MODE = beforeMode;
  }
});
