import { rankedMarketingRequests, type ChannelId } from "../../lib/marketing/policy";
import type { MarketingDraft } from "../../lib/marketing/draft";
import {
  initialWorkflow, isMarketingIntake, isSubmittedRequest, isWorkflowEvent, marketingDate, rankWorkflowRequests,
  submittedRequestId, transitionWorkflow, type MarketingIntake, type SubmittedMarketingRequest,
  type WorkflowEvents, type WorkflowStatus,
} from "../../lib/marketing/workflow";

type RankChange = {
  requestId: string;
  reason: string;
  rankings: { id: string; score: number; before: number; after: number }[];
};

export type DraftRecord = {
  draft: MarketingDraft;
  status: "검토 대기" | "수정됨" | "승인됨" | "반려됨";
  editedTitle?: string;
  editedText?: string;
};

type MarketingState = {
  order: string[];
  rankChanges: RankChange[];
  channels: Record<string, Partial<Record<ChannelId, boolean>>>;
  drafts: Record<string, DraftRecord>;
  submitted: SubmittedMarketingRequest[];
  workflows: WorkflowEvents;
};

const storageKey = "mirinae:marketing:v1";
const changeEvent = "mirinae:marketing-change";
const initialOrder = rankedMarketingRequests.map(({ id }) => id);
const initialState: MarketingState = { order: initialOrder, rankChanges: [], channels: {}, drafts: {}, submitted: [], workflows: {} };

export function readMarketingSnapshot() {
  try { return window.localStorage.getItem(storageKey); } catch { return null; }
}

export function isMarketingDraft(value: unknown): value is MarketingDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as MarketingDraft;
  return ["live", "recorded", "template"].includes(draft.mode) && typeof draft.title === "string"
    && Array.isArray(draft.lines) && draft.lines.every(line => line && typeof line.text === "string"
      && (line.sourceUrl === undefined || typeof line.sourceUrl === "string"))
    && Array.isArray(draft.sources) && draft.sources.every(source => source && typeof source.title === "string"
      && typeof source.url === "string")
    && Array.isArray(draft.warnings) && draft.warnings.every(warning => typeof warning === "string");
}

export function readMarketingState(snapshot = readMarketingSnapshot()): MarketingState {
  if (!snapshot) return initialState;
  try {
    const parsed = JSON.parse(snapshot) as MarketingState;
    const submitted = parsed.submitted === undefined ? [] : parsed.submitted;
    const workflows = parsed.workflows === undefined ? {} : parsed.workflows;
    if (!Array.isArray(submitted) || !submitted.every((request, index) => isSubmittedRequest(request)
      && request.id === "M" + String(initialOrder.length + index + 1).padStart(2, "0"))) return initialState;
    const requestIds = [...initialOrder, ...submitted.map(request => request.id)];
    if (workflows === null || typeof workflows !== "object" || Array.isArray(workflows)
      || !Object.entries(workflows).every(([id, history]) => requestIds.includes(id)
        && Array.isArray(history) && history[0]?.status === "접수" && history.every(isWorkflowEvent))) return initialState;
    if (Array.isArray(parsed.order) && parsed.order.length === requestIds.length
        && requestIds.every(id => parsed.order.includes(id)) && Array.isArray(parsed.rankChanges)
        && parsed.rankChanges.every(change => change && typeof change.reason === "string" && Array.isArray(change.rankings)
          && change.rankings.every(row => row && typeof row.id === "string"))
        && parsed.channels && typeof parsed.channels === "object" && parsed.drafts && typeof parsed.drafts === "object"
        && Object.values(parsed.drafts).every(record => record && isMarketingDraft(record.draft)
          && ["검토 대기", "수정됨", "승인됨", "반려됨"].includes(record.status)
          && (record.editedText === undefined || typeof record.editedText === "string")
          && (record.editedTitle === undefined || typeof record.editedTitle === "string"))) return { ...parsed, submitted, workflows };
  } catch { /* Invalid browser state falls back to the initial ranking. */ }
  return initialState;
}

export function subscribeToMarketingState(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(changeEvent, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(changeEvent, listener);
  };
}

export function updateMarketingState(update: (state: MarketingState) => MarketingState) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(update(readMarketingState())));
    window.dispatchEvent(new Event(changeEvent));
    return true;
  } catch {
    return false;
  }
}

export function hasApprovedDraft(drafts: MarketingState["drafts"], requestId: string) {
  return Object.entries(drafts).some(([key, draft]) => key.startsWith(requestId + ":") && draft.status === "승인됨");
}

export function resetMarketingDemo() {
  try {
    window.localStorage.removeItem(storageKey);
    window.dispatchEvent(new Event(changeEvent));
    return true;
  } catch {
    return false;
  }
}

export function submitMarketingRequest(intake: MarketingIntake) {
  if (!isMarketingIntake(intake)) return null;
  let createdId: string | undefined;
  const saved = updateMarketingState(previous => {
    const id = submittedRequestId(previous.submitted);
    const at = new Date().toISOString();
    const submitted = [...previous.submitted, { ...intake, memo: intake.memo.trim(), id, receivedOn: marketingDate(at) }];
    const ranked = rankWorkflowRequests(submitted);
    const position = ranked.findIndex(request => request.id === id);
    let order = ranked.map(request => request.id);
    if (previous.rankChanges.length > 0) {
      const lowerPriority = new Set(order.slice(position + 1));
      order = [...previous.order];
      const firstLower = order.findIndex(existing => lowerPriority.has(existing));
      order.splice(firstLower === -1 ? order.length : firstLower, 0, id);
    }
    const workflows = { ...previous.workflows, [id]: [{ status: "접수" as const, actor: intake.requester, at }] };
    createdId = id;
    return { ...previous, submitted, order, workflows };
  });
  return saved && createdId ? createdId : null;
}

export function updateMarketingWorkflow(id: string, status: Exclude<WorkflowStatus, "접수">, assignee: string, reason = "") {
  let changed = false;
  const saved = updateMarketingState(previous => {
    const request = rankWorkflowRequests(previous.submitted).find(row => row.id === id);
    if (!request) return previous;
    const history = previous.workflows[id] ?? initialWorkflow(request);
    const event = transitionWorkflow(history,
      { status, assignee, reason, approved: hasApprovedDraft(previous.drafts, id) }, previous.workflows, new Date().toISOString());
    if (!event) return previous;
    changed = true;
    return { ...previous, workflows: { ...previous.workflows, [id]: [...history, event] } };
  });
  return saved && changed;
}
