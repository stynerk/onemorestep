import assert from "node:assert/strict";
import { test } from "node:test";
import { marketingDraftTemplate } from "../src/lib/marketing/draft";
import { rankedMarketingRequests } from "../src/lib/marketing/policy";
import { deadlineWarning, isMarketingIntake, marketingAssignees, rankWorkflowRequests, type MarketingIntake } from "../src/lib/marketing/workflow";
import { readMarketingState, resetMarketingDemo, submitMarketingRequest, updateMarketingState, updateMarketingWorkflow } from "../src/app/marketing/storage";

const sample: MarketingIntake = {
  requester: "본사 세일즈 · 유럽 담당", type: "사례 자료", product: "PM-50", region: "APAC", stage: "문의",
  deadline: "2026-11-27", dealSize: "대", memo: "입찰 준비에 공개 사례 요약이 필요합니다.", leadId: "L06", regionFromLead: true,
};

test("intake validation, scoring and the 90-day repeated-product-and-type boundary", () => {
  assert.equal(isMarketingIntake(sample), true);
  assert.equal(isMarketingIntake({ ...sample, memo: " " }), false);
  assert.equal(isMarketingIntake({ ...sample, deadline: "2026-02-30" }), false);
  assert.equal(isMarketingIntake({ ...sample, leadId: "" }), false);
  const fresh = { ...sample, type: "캠페인" as const, id: "M09", receivedOn: "2026-11-24" };
  const request = rankWorkflowRequests([
    fresh,
    { ...fresh, id: "M10", receivedOn: "2026-08-26" },
    { ...fresh, id: "M11", receivedOn: "2026-08-25" },
    { ...fresh, id: "M12", product: "US-200" },
  ]).find(item => item.id === "M09");
  assert.deepEqual(request?.repeats, ["M10"]);
  assert.equal(request.score, 81);
  assert.deepEqual(rankedMarketingRequests.map(item => item.score), [86, 61, 53, 50, 40, 28, 24, 23]);
  assert.equal(deadlineWarning(3, "진행"), "마감 임박");
  assert.equal(deadlineWarning(3, "검토"), null);
  assert.equal(deadlineWarning(4, "접수"), null);
  assert.equal(deadlineWarning(-1, "검토"), "마감 초과");
  assert.equal(deadlineWarning(-1, "반려"), "마감 초과");
  assert.equal(deadlineWarning(-1, "완료"), null);
});

test("legacy state migrates and workflow persists assigned events, approval gates, codes and rejection reasons", t => {
  const order = rankedMarketingRequests.map(item => item.id);
  const priorRank = { requestId: "M06", reason: "입찰 준비 기간", rankings: [{ id: "M06", score: 53, before: 3, after: 2 }] };
  const legacy = { order: [order[0], order[2], order[1], ...order.slice(3)], rankChanges: [priorRank], channels: {}, drafts: {} };
  const state = readMarketingState(JSON.stringify(legacy));
  assert.deepEqual(state.order, legacy.order);
  assert.deepEqual(state.rankChanges, legacy.rankChanges);
  assert.deepEqual(state.submitted, []);
  assert.deepEqual(state.workflows, {});

  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const values = new Map([["mirinae:marketing:v1", JSON.stringify(legacy)]]);
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, text: string) => values.set(key, text),
      removeItem: (key: string) => values.delete(key),
    },
    dispatchEvent() {},
  } });
  t.after(() => {
    if (windowDescriptor) Object.defineProperty(globalThis, "window", windowDescriptor);
    else Reflect.deleteProperty(globalThis, "window");
  });

  const firstRequest = submitMarketingRequest(sample);
  const secondRequest = submitMarketingRequest({ ...sample, memo: "두 번째 자료 요청" });
  assert.equal(firstRequest, "M09");
  assert.equal(secondRequest, "M10");
  assert.deepEqual(readMarketingState().order.filter(id => id !== firstRequest && id !== secondRequest), legacy.order);
  const assignee = marketingAssignees[0];
  assert.equal(updateMarketingWorkflow(firstRequest, "진행", ""), false);
  assert.equal(updateMarketingWorkflow(firstRequest, "진행", assignee), true);
  assert.equal(updateMarketingWorkflow(firstRequest, "완료", ""), false);
  assert.equal(updateMarketingWorkflow(firstRequest, "검토", ""), true);
  assert.equal(updateMarketingWorkflow(firstRequest, "완료", ""), false);
  assert.equal(updateMarketingState(previous => ({
    ...previous,
    drafts: { ...previous.drafts, [firstRequest + ":linkedin"]: { draft: marketingDraftTemplate("linkedin"), status: "승인됨", editedText: "공개 자료 기준 검토용" } },
  })), true);
  assert.equal(updateMarketingWorkflow(firstRequest, "완료", ""), true);
  assert.equal(updateMarketingWorkflow(firstRequest, "반려", assignee, "요청 범위 조정"), false);
  const completed = readMarketingState().workflows[firstRequest];
  assert.deepEqual(completed.map(event => event.status), ["접수", "진행", "검토", "완료"]);
  assert.deepEqual(completed.map(event => event.actor), [sample.requester, assignee, assignee, assignee]);
  assert.equal(completed.at(-1)?.code, "C05");
  assert.ok(completed.every(event => Number.isFinite(Date.parse(event.at))));

  assert.equal(updateMarketingWorkflow(secondRequest, "반려", assignee, " "), false);
  assert.equal(updateMarketingWorkflow(secondRequest, "반려", assignee, "  진행 범위 중복  "), true);
  assert.equal(readMarketingState().workflows[secondRequest].at(-1)?.reason, "진행 범위 중복");
  assert.equal(resetMarketingDemo(), true);
  assert.deepEqual(readMarketingState().order, order);
  assert.deepEqual(readMarketingState().workflows, {});
});
