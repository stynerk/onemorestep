import { industryHandoffForLead } from "../../lib/forwarding/industry-demo";
import { automaticConfirmationForLead, inboxBucket, verdictLabels } from "../../lib/forwarding/inbox";
import { openAssignment, reassignmentProposal } from "../../lib/forwarding/reassignment";
import { VERDICTS, type AssessmentHandoff, type ForwardingState, type LeadInput } from "../../lib/forwarding/types";

export const inboxGroups = [...VERDICTS, "new"] as const;
export type InboxGroup = (typeof inboxGroups)[number];
export const handoffFilters = ["dealer", "regional-sales", "hr", "none"] as const;
export const dealerFilters = ["dealer-waiting", "reassignment"] as const;
export const ambiguousPaths = ["automatic-confirmation", "human-review"] as const;
export type AmbiguousPath = (typeof ambiguousPaths)[number];
const filters = ["all", "assessed", ...inboxGroups, ...handoffFilters, ...dealerFilters, ...ambiguousPaths] as const;
export type InboxFilter = (typeof filters)[number];

export const inboxFilterLabel: Record<InboxFilter, string> = {
  ...verdictLabels,
  all: "전체 문의", new: "미선별", assessed: "선별 완료",
  dealer: "딜러", "regional-sales": "권역팀", hr: "인사팀", none: "없음",
  "dealer-waiting": "딜러 응답 대기", reassignment: "재배정 제안",
  "automatic-confirmation": "자동 확인 메일 대기", "human-review": "사람 확인 필요",
};

export function readInboxFilter(filter: string | null): InboxFilter {
  return filters.find((option) => option === filter) ?? "all";
}

export function inboxFilterPath(filter: InboxFilter) {
  return filter === "all" ? "/inbox" : "/inbox?filter=" + filter;
}

export type InboxRow = {
  lead: LeadInput;
  group: InboxGroup;
  handoff: AssessmentHandoff | null;
  ambiguousPath: AmbiguousPath | null;
  dealerWaiting: boolean;
  reassignment: boolean;
};

export function inboxRows(state: ForwardingState, responseNow: number) {
  return state.leads.map((lead): InboxRow => {
    const assignment = openAssignment(state, lead.id);
    const reassignment = assignment !== undefined && Boolean(reassignmentProposal(state, lead, responseNow));
    const group = inboxBucket(state, lead) ?? "new";
    const automaticConfirmation = group === "ambiguous" && automaticConfirmationForLead(state, lead) !== null;
    const ambiguousPath = group === "ambiguous" ? automaticConfirmation ? "automatic-confirmation" : "human-review" : null;
    return {
      lead, reassignment, dealerWaiting: assignment !== undefined && !reassignment,
      group, ambiguousPath, handoff: automaticConfirmation ? null : industryHandoffForLead(state, lead),
    };
  });
}

export function matchesInboxFilter(row: InboxRow, filter: InboxFilter) {
  if (filter === "all") return true;
  if (filter === "assessed") return row.group !== "new";
  if (filter === "dealer-waiting") return row.dealerWaiting;
  if (filter === "reassignment") return row.reassignment;
  return filter === row.group || filter === row.handoff?.kind || filter === row.ambiguousPath;
}
