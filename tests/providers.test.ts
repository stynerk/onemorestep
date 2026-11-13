import assert from "node:assert/strict";
import { test } from "node:test";
import { research } from "../src/lib/research";
import { aiMode, modelConfig, searchConfig } from "../src/lib/providers/config";
import { proposeWorkflow, type PlanningInput, type WorkflowProposal } from "../src/lib/planning";
import { POST } from "../src/app/api/planning/route";

const source = { title: "공개 근거", url: "https://example.com/report", description: "가상 테스트 자료" };
const input: PlanningInput = { revision: "company-2", company: "가상 자율주행 관제 회사", change: "파일럿 파트너 협의 시작", existingTasks: [{ id: "old", title: "파트너 후보 탐색", status: "doing" }, { id: "done", title: "시제품 검토", status: "done" }], evidence: [source] };
const proposal: WorkflowProposal = { summary: "파일럿 범위 협의 준비", tasks: [
  { id: "old", action: "defer", title: "추가 파트너 탐색 보류 검토", reason: "현재 협의를 먼저 검토", sourceUrls: [], dependsOn: [] },
  { id: "new", action: "add", title: "파일럿 역할 협의 질문 작성", reason: "새 협의 범위를 확인", sourceUrls: [source.url], dependsOn: [] },
] };
const neverFetch: typeof fetch = async () => { throw new Error("Unexpected external request"); };
const completion = (value: unknown, finish = "stop") => Response.json({ choices: [{ finish_reason: finish, message: { content: JSON.stringify(value) } }] });

test("environment selects search and planning independently without sharing replacement credentials", () => {
  assert.equal(searchConfig({}).provider, "liner");
  assert.equal(modelConfig({}).model, "liner-claude-router");
  const env = { LINER_API_KEY: "liner-test", SEARCH_PROVIDER: "http-json", SEARCH_API_KEY: "search-test", SEARCH_API_URL: "https://search.example/query", PLANNER_PROVIDER: "chat-completions", PLANNER_MODEL: "other-model", PLANNER_API_URL: "https://model.example/chat", PLANNER_API_KEY: "model-test" };
  assert.equal(searchConfig(env).apiKey, "search-test");
  assert.equal(modelConfig(env).apiKey, "model-test");
  assert.equal(aiMode({ LINER_MODE: "live" }), "live");
  assert.equal(aiMode({ AI_MODE: "sample", LINER_MODE: "live" }), "sample");
});

test("replacement search normalizes to the unchanged research contract", async () => {
  const result = await research("실증 협력", { mode: "live", config: { provider: "http-json", endpoint: "https://search.example/query", apiKey: "replacement-test" }, fetcher: async (url, init) => {
    assert.equal(url, "https://search.example/query");
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer replacement-test");
    assert.equal(new Headers(init?.headers).get("x-api-key"), null);
    assert.equal(init?.redirect, "error");
    assert.deepEqual(JSON.parse(String(init?.body)), { query: "실증 협력", maxResults: 3, locale: "ko-KR" });
    return Response.json({ sources: [{ ...source, secret: "provider-private" }] });
  } });
  assert.deepEqual(result.sources, [source]);
  assert.equal(result.mode, "live");
  assert.doesNotMatch(JSON.stringify(result), /replacement-test|provider-private|Liner 실시간/);
});

test("unsupported provider and unsafe replacement endpoint do not send credentials", async () => {
  for (const config of [
    { provider: "typo", apiKey: "secret" },
    { provider: "http-json", endpoint: "http://example.com", apiKey: "secret" },
    { provider: "http-json", endpoint: "https://user:pass@example.com", apiKey: "secret" },
  ]) {
    assert.equal((await research("공개 조사", { mode: "live", config, fetcher: neverFetch })).mode, "sample");
    assert.equal((await proposeWorkflow(input, { mode: "live", config, fetcher: neverFetch })).status, "unavailable");
  }
});

test("Liner and replacement model return the same validated workflow contract", async () => {
  for (const provider of ["liner", "chat-completions"]) {
    const original = structuredClone(input);
    const result = await proposeWorkflow(input, { mode: "live", config: { provider, apiKey: "test-key", endpoint: "https://model.example/chat", model: provider === "liner" ? "liner-claude-router" : "other-model" }, fetcher: async (url, init) => {
      assert.equal(url, provider === "liner" ? "https://platform.liner.com/api/v1/chat/completions" : "https://model.example/chat");
      const body = JSON.parse(String(init?.body));
      assert.equal(body.routing_strategy, provider === "liner" ? "balanced" : undefined);
      assert.equal(body.model, provider === "liner" ? "liner-claude-router" : "other-model");
      assert.equal(body.response_format.type, "json_schema");
      assert.equal(JSON.parse(body.messages[1].content).revision, input.revision);
      assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer test-key");
      return completion({ ...proposal, privateField: "hidden" });
    } });
    assert.equal(result.status, "ready");
    assert.equal(result.revision, input.revision);
    assert.deepEqual(result.proposal, proposal);
    assert.deepEqual(input, original); // A proposal never mutates the submitted tasks.
    assert.doesNotMatch(JSON.stringify(result), /test-key|privateField|hidden/);
  }
});

test("invalid, ungrounded, completed-target, cyclic and truncated proposals are never returned", async () => {
  const task = proposal.tasks[1];
  const bad = [
    { ...proposal, tasks: [{ ...task, sourceUrls: ["https://invented.example/"] }] },
    { ...proposal, tasks: [{ ...task, action: "update", id: "done" }] },
    { ...proposal, tasks: [{ ...task, action: ["update"], id: "old" }] },
    { ...proposal, tasks: [{ ...task, action: "update", id: "missing" }] },
    { ...proposal, tasks: [{ ...task, id: "old" }] },
    { ...proposal, tasks: [{ ...task, dependsOn: ["missing"] }] },
    { ...proposal, tasks: [{ ...task, dependsOn: ["new2"] }, { ...task, id: "new2", dependsOn: ["new"] }] },
    { ...proposal, tasks: [task, task] },
    { summary: "missing tasks" },
  ];
  for (const value of bad) {
    const result = await proposeWorkflow(input, { mode: "live", config: { provider: "liner", apiKey: "secret" }, fetcher: async () => completion(value) });
    assert.equal(result.status, "unavailable");
    assert.equal(result.proposal, null);
  }
  const truncated = await proposeWorkflow(input, { mode: "live", config: { provider: "liner", apiKey: "secret" }, fetcher: async () => completion(proposal, "length") });
  assert.equal(truncated.status, "unavailable");
});

test("offline, missing configuration and failed model calls never fabricate a ready plan", async () => {
  assert.equal((await proposeWorkflow(input, { config: { provider: "liner", apiKey: "secret" }, fetcher: neverFetch })).status, "disabled");
  assert.equal((await proposeWorkflow(input, { mode: "live", fetcher: neverFetch })).status, "unavailable");
  for (const fetcher of [async () => new Response("private body", { status: 429 }), async () => new Response("not JSON"), async () => { throw new Error("secret failure"); }]) {
    const result = await proposeWorkflow(input, { mode: "live", config: { provider: "liner", apiKey: "secret" }, fetcher });
    assert.equal(result.proposal, null);
    assert.doesNotMatch(JSON.stringify(result), /secret|private body/);
  }
});

test("model timeout preserves a typed unavailable result", async () => {
  const result = await proposeWorkflow(input, { mode: "live", timeoutMs: 5, config: { provider: "liner", apiKey: "test" }, fetcher: async (_url, init) => new Promise((_resolve, reject) => {
    const guard = setTimeout(() => reject(new Error("guard")), 500);
    init?.signal?.addEventListener("abort", () => { clearTimeout(guard); reject(new Error("aborted")); }, { once: true });
  }) });
  assert.equal(result.status, "unavailable");
});

test("planning route validates context, uses server mode and returns no-store", async () => {
  for (const value of [null, {}, { ...input, existingTasks: [{ id: "old", title: "x", status: ["todo"] }] }]) {
    assert.equal((await POST(new Request("http://localhost/api/planning", { method: "POST", body: JSON.stringify(value) }))).status, 400);
  }
  const previous = process.env.AI_MODE;
  try {
    process.env.AI_MODE = "sample";
    const response = await POST(new Request("http://localhost/api/planning", { method: "POST", body: JSON.stringify({ ...input, apiKey: "ignored", provider: "untrusted" }) }));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    const body = await response.json();
    assert.equal(body.status, "disabled");
    assert.equal(body.proposal, null);
    assert.doesNotMatch(JSON.stringify(body), /ignored|untrusted/);
  } finally { if (previous === undefined) delete process.env.AI_MODE; else process.env.AI_MODE = previous; }
});
