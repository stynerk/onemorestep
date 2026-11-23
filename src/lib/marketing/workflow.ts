import type { Product } from "../forwarding/types";
import { marketingPriority, marketingRequests, rankMarketingRequests, type ChannelId, type MarketingRequest } from "./policy";

export const demoDate = "2026-11-24";
const millisecondsPerDay = 86_400_000;
const demoDateMs = Date.parse(demoDate);
const urgentDays = 3;

export const salesRequesters = ["본사 세일즈 · 유럽 담당", "본사 세일즈 · 아시아 담당", "본사 세일즈 · 북미 담당"] as const;
export const marketingAssignees = ["마케팅 · 콘텐츠 담당", "마케팅 · 캠페인 담당"] as const;
export const products = ["PM-50", "US-200", "IS-3"] as const satisfies readonly Product[];
export const workflowStatuses = ["접수", "진행", "검토", "완료", "반려"] as const;
export const marketingRegions = Object.keys(marketingPriority.region) as MarketingRequest["region"][];
export const marketingDealSizes = Object.keys(marketingPriority.dealSize) as MarketingRequest["dealSize"][];

const recommendedChannelsByType = {
  "사례 자료": ["linkedin", "email", "blog"],
  "전시회·행사": ["linkedin", "facebook", "instagram"],
  "신제품 소개": ["linkedin", "instagram", "blog"],
  "캠페인": ["facebook", "instagram", "email"],
  "블로그·콘텐츠": ["blog", "linkedin"],
} as const satisfies Record<string, readonly ChannelId[]>;
export const requestTypes = Object.keys(recommendedChannelsByType) as (keyof typeof recommendedChannelsByType)[];

export type WorkflowStatus = (typeof workflowStatuses)[number];
type Assignee = (typeof marketingAssignees)[number];
export type MarketingIntake = {
  requester: (typeof salesRequesters)[number];
  type: (typeof requestTypes)[number];
  product: Product;
  region: MarketingRequest["region"];
  deadline: string;
  dealSize: MarketingRequest["dealSize"];
  memo: string;
  leadId: string;
  stage: "없음" | "문의" | "견적";
  regionFromLead: boolean;
};

export type SubmittedMarketingRequest = MarketingIntake & { id: string; receivedOn: string };
export type WorkflowEvent = { status: WorkflowStatus; at: string; actor: string; reason?: string; code?: string };
export type WorkflowEvents = Record<string, WorkflowEvent[]>;

function isIn<T extends string>(options: readonly T[], value: unknown): value is T {
  return options.some(option => option === value);
}

export function daysUntil(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(date)) return null;
  const ms = Date.parse(date);
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== date) return null;
  return (ms - demoDateMs) / millisecondsPerDay;
}

export function marketingDate(at: string) {
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(at));
  return ["year", "month", "day"].map(type => date.find(part => part.type === type)?.value ?? "").join("-");
}

export function isMarketingIntake(value: unknown): value is MarketingIntake {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<MarketingIntake>;
  return isIn(salesRequesters, item.requester) && isIn(requestTypes, item.type) && isIn(products, item.product)
    && isIn(marketingRegions, item.region) && isIn(marketingDealSizes, item.dealSize)
    && typeof item.deadline === "string" && daysUntil(item.deadline) !== null
    && typeof item.memo === "string" && item.memo.trim().length > 0 && item.memo.length <= 400
    && typeof item.leadId === "string" && (item.leadId === "" || /^L\d{2}$/u.test(item.leadId))
    && isIn(["없음", "문의", "견적"], item.stage) && typeof item.regionFromLead === "boolean"
    && (item.leadId !== "" || (item.stage === "없음" && !item.regionFromLead));
}

export function isSubmittedRequest(value: unknown): value is SubmittedMarketingRequest {
  return isMarketingIntake(value) && "id" in value && typeof value.id === "string" && /^M(?:09|[1-9]\d+)$/u.test(value.id)
    && "receivedOn" in value && typeof value.receivedOn === "string" && daysUntil(value.receivedOn) !== null;
}

export function isWorkflowEvent(value: unknown): value is WorkflowEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<WorkflowEvent>;
  return isIn(workflowStatuses, event.status) && typeof event.at === "string" && Number.isFinite(Date.parse(event.at))
    && typeof event.actor === "string" && event.actor.trim().length > 0
    && (event.status === "반려" ? typeof event.reason === "string" && event.reason.trim().length > 0 : event.reason === undefined)
    && (event.status === "완료" ? typeof event.code === "string" && /^C\d{2,}$/u.test(event.code)
      && Number.isSafeInteger(Number(event.code.slice(1))) : event.code === undefined);
}

export function submittedRequestId(submitted: readonly SubmittedMarketingRequest[]) {
  return "M" + String(submitted.length + marketingRequests.length + 1).padStart(2, "0");
}

export function rankWorkflowRequests(submitted: readonly SubmittedMarketingRequest[]) {
  const converted: MarketingRequest[] = submitted.map(request => ({
    id: request.id,
    title: request.product + " · " + request.type,
    requester: request.requester,
    topic: request.product + ":" + request.type,
    receivedDaysAgo: -(daysUntil(request.receivedOn) ?? 0),
    region: request.region,
    stage: request.stage,
    dealSize: request.dealSize,
    deadlineDays: daysUntil(request.deadline),
    recommendedChannels: recommendedChannelsByType[request.type],
  }));
  return rankMarketingRequests([...marketingRequests, ...converted]);
}

export function initialWorkflow(request: MarketingRequest): WorkflowEvent[] {
  const at = new Date(demoDateMs - request.receivedDaysAgo * millisecondsPerDay + 3 * 3_600_000).toISOString();
  return [{ status: "접수", actor: request.requester, at }];
}

export function deadlineWarning(days: number | null, status: WorkflowStatus) {
  if (days === null || status === "완료") return null;
  if (days < 0) return "마감 초과";
  if (days <= urgentDays && (status === "접수" || status === "진행")) return "마감 임박";
  return null;
}

type Transition = { status: Exclude<WorkflowStatus, "접수">; assignee: string; reason: string; approved: boolean };

export function transitionWorkflow(
  history: readonly WorkflowEvent[], transition: Transition, allEvents: WorkflowEvents, at: string,
): WorkflowEvent | null {
  const current = history.at(-1)?.status ?? "접수";
  if (current === "완료" || current === "반려") return null;
  const assigned = history.find(event => event.status === "진행")?.actor;
  const actor = assigned ?? (isIn<Assignee>(marketingAssignees, transition.assignee) ? transition.assignee : undefined);
  if (!actor) return null;
  if (transition.status === "반려") {
    const reason = transition.reason.trim();
    return reason && reason.length <= 180 ? { status: "반려", actor, at, reason } : null;
  }
  if (current === "접수" && transition.status === "진행") return { status: "진행", actor, at };
  if (current === "진행" && transition.status === "검토") return { status: "검토", actor, at };
  if (current !== "검토" || transition.status !== "완료" || !transition.approved) return null;
  const numbers = Object.values(allEvents).flatMap(events => events.map(event => Number(event.code?.slice(1)) || 0));
  const code = "C" + String(Math.max(4, ...numbers) + 1).padStart(2, "0");
  return { status: "완료", actor, at, code };
}
