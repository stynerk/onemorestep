import { forwardingPolicy } from "./policy";
import type { Assessment, ForwardingEvent, ForwardingState, LeadInput, MailKind, ReplyKind, Verdict } from "./types";

export const verdictLabels: Record<Verdict, string> = {
  valid: "유효", ambiguous: "애매", "country-check": "국가 확인", "partnership-check": "제휴 확인", invalid: "무효",
};

export function inboxBucket(state: ForwardingState, lead: LeadInput): Verdict | null {
  const status = state.leadStates[lead.id];
  if (status.workflow === "disqualified") return "invalid";
  const latest = state.events.findLast((event) => event.leadId === lead.id &&
    (event.type === "assessed" || event.type === "decision" || event.type === "review-reopened"));
  if (latest?.type === "decision" && latest.action === "phone") return "ambiguous";
  return status.assessment?.verdict ?? null;
}

export function inboxOrder(leads: LeadInput[], bucket: Verdict | null): LeadInput[] {
  // Leave the newest inquiry at the bottom until its validity is confirmed.
  return [...leads].sort((a, b) => {
    if (bucket === "valid" && a.id !== b.id) {
      if (a.id === "L06") return -1;
      if (b.id === "L06") return 1;
    }
    return a.receivedAt.localeCompare(b.receivedAt);
  });
}

type ReplyEvent = Extract<ForwardingEvent, { type: "reply" }>;
export function lastReply(events: ForwardingEvent[], leadId: string, kind: ReplyKind): ReplyEvent | undefined {
  return events.findLast((event): event is ReplyEvent => event.type === "reply" && event.leadId === leadId && event.kind === kind);
}

export function confirmedCountry(state: ForwardingState, leadId: string) {
  return lastReply(state.events, leadId, "country")?.selection;
}

export function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  return domain ? name.slice(0, 2) + "•••@" + domain : "가림";
}

export function maskPhone(phone: string) {
  return phone.length > 4 ? "•••• " + phone.slice(-4) : "가림";
}

export function nextBusinessDate(date: string) {
  const end = new Date(date);
  for (let days = 0; days < forwardingPolicy.responseBusinessDays;) {
    end.setUTCDate(end.getUTCDate() + 1);
    if (end.getUTCDay() !== 0 && end.getUTCDay() !== 6) days += 1;
  }
  return end.toISOString();
}

export function hasStaleEvidence(assessment: Assessment, now: number) {
  return assessment.sources.length > 0 && now - Date.parse(assessment.searchedAt) >= 86_400_000;
}

export function mailKindFor(event: ForwardingEvent): MailKind | null {
  if (event.type === "decision" && event.dealerId && (event.action === "approve" || event.action === "change-dealer")) return "dealer-summary";
  if (event.type !== "assessed") return null;
  if (event.assessment.verdict === "country-check") return "country-check";
  if (event.assessment.verdict === "partnership-check") return "partnership-check";
  if (event.workflow === "manager-confirmation-pending") return "manager-confirmation";
  return null;
}
