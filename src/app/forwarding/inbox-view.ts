import { industryHandoffForLead } from "../../lib/forwarding/industry-demo";
import { inboxBucket, verdictLabels } from "../../lib/forwarding/inbox";
import { openAssignment, reassignmentProposal } from "../../lib/forwarding/reassignment";
import { VERDICTS, type AssessmentHandoff, type ForwardingState, type LeadInput } from "../../lib/forwarding/types";

export const inboxGroups = [...VERDICTS, "new"] as const;
export type InboxGroup = (typeof inboxGroups)[number];
export const handoffFilters = ["dealer", "regional-sales", "hr", "none"] as const;
export const dealerFilters = ["dealer-waiting", "reassignment"] as const;
const filters = ["all", "assessed", ...inboxGroups, ...handoffFilters, ...dealerFilters] as const;
export type InboxFilter = (typeof filters)[number];

export const inboxFilterLabel: Record<InboxFilter, string> = {
  ...verdictLabels,
  all: "전체 문의", new: "미선별", assessed: "선별 완료",
  dealer: "딜러", "regional-sales": "권역팀", hr: "인사팀", none: "없음",
  "dealer-waiting": "딜러 응답 대기", reassignment: "재배정 제안",
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
  dealerWaiting: boolean;
  reassignment: boolean;
};

export function inboxRows(state: ForwardingState, responseNow: number) {
  return state.leads.map((lead): InboxRow => {
    const assignment = openAssignment(state, lead.id);
    const reassignment = assignment !== undefined && Boolean(reassignmentProposal(state, lead, responseNow));
    return {
      lead, reassignment, dealerWaiting: assignment !== undefined && !reassignment,
      group: inboxBucket(state, lead) ?? "new",
      handoff: industryHandoffForLead(state, lead),
    };
  });
}

export function matchesInboxFilter(row: InboxRow, filter: InboxFilter) {
  if (filter === "all") return true;
  if (filter === "assessed") return row.group !== "new";
  if (filter === "dealer-waiting") return row.dealerWaiting;
  if (filter === "reassignment") return row.reassignment;
  return filter === row.group || filter === row.handoff?.kind;
}
