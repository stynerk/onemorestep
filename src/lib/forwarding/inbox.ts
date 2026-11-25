import { automaticConfirmationFor, isAutomaticConfirmation, isConfirmationMail } from "./confirmation";
import { forwardingPolicy } from "./policy";
import type { Assessment, ForwardingEvent, ForwardingState, LeadInput, MailKind, ReplyKind, Verdict, WorkflowPolicy } from "./types";

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

export function automaticConfirmationForLead(state: ForwardingState, lead: LeadInput) {
  const status = state.leadStates[lead.id];
  return status?.workflow === "reply-pending" && status.assessment ? automaticConfirmationFor(status.assessment) : null;
}

export function lastConfirmationReply(events: ForwardingEvent[], leadId: string) {
  return events.findLast((event): event is ReplyEvent =>
    event.type === "reply" && event.leadId === leadId && isAutomaticConfirmation(event.kind));
}

export function inboxOrder(leads: LeadInput[], bucket: Verdict | null, prioritizedLeadId: string | null = "L06"): LeadInput[] {
  // Leave the newest inquiry at the bottom until its validity is confirmed.
  return [...leads].sort((a, b) => {
    if (bucket === "valid" && a.id !== b.id) {
      if (a.id === prioritizedLeadId) return -1;
      if (b.id === prioritizedLeadId) return 1;
    }
    return a.receivedAt.localeCompare(b.receivedAt);
  });
}

type ReplyEvent = Extract<ForwardingEvent, { type: "reply" }>;
export function lastReply(events: ForwardingEvent[], leadId: string, kind: ReplyKind): ReplyEvent | undefined {
  return events.findLast((event): event is ReplyEvent => event.type === "reply" && event.leadId === leadId && event.kind === kind);
}

export function confirmedCountry(state: ForwardingState, leadId: string) {
  const assessment = state.leadStates[leadId]?.assessment;
  const country = assessment?.directionConfirmation && assessment.verdict === "valid" && assessment.details?.countries.length === 1
    ? assessment.details.countries[0] : undefined;
  return country ?? lastReply(state.events, leadId, "country")?.selection;
}

export function confirmedManagerDealer(state: ForwardingState, leadId: string) {
  const latest = state.events.findLast((event) => event.leadId === leadId &&
    (event.type === "reassigned" || (event.type === "reply" && event.kind === "manager-confirmation")));
  return latest?.type === "reply" ? latest.selection : undefined;
}

export function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  return domain ? name.slice(0, 2) + "•••@" + domain : "가림";
}

export function maskPhone(phone: string) {
  return phone.length > 4 ? "•••• " + phone.slice(-4) : "가림";
}

const seoulWeekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: forwardingPolicy.responseTimeZone });

export function nextBusinessDate(date: string, businessDays: number = forwardingPolicy.responseBusinessDays) {
  let end = Date.parse(date);
  // Seoul uses a fixed UTC+09 offset during the demo dates, so a whole day preserves its wall clock.
  for (let days = 0; days < businessDays; days += 1) {
    let weekday: string;
    do {
      end += 86_400_000;
      weekday = seoulWeekday.format(end);
    } while (weekday === "Sat" || weekday === "Sun");
  }
  return new Date(end).toISOString();
}

export function responseDeadline(state: ForwardingState, date: string) {
  return nextBusinessDate(date, state.policy?.responseBusinessDays);
}

export function hasStaleEvidence(assessment: Assessment, now: number) {
  return assessment.sources.length > 0 && now - Date.parse(assessment.searchedAt) >= 86_400_000;
}

export function mailKindFor(event: ForwardingEvent): MailKind | null {
  if (event.type === "decision" && event.dealerId && (event.action === "approve" || event.action === "change-dealer")) return "dealer-summary";
  if (event.type === "reassigned") {
    if (event.target === "dealer") return "dealer-summary";
    return event.target === "manager-confirmation" ? "manager-confirmation" : null;
  }
  if (event.type !== "assessed") return null;
  const confirmation = event.workflow === "reply-pending" && automaticConfirmationFor(event.assessment);
  if (confirmation) return confirmation === "free-email" ? "free-email-confirmation" : "weak-intent-confirmation";
  if (event.assessment.verdict === "country-check") return "country-check";
  if (event.assessment.verdict === "partnership-check") return "partnership-check";
  if (event.workflow === "manager-confirmation-pending") return "manager-confirmation";
  return null;
}

export function mailKindForLead(event: ForwardingEvent, lead: LeadInput, policy: WorkflowPolicy = forwardingPolicy): MailKind | null {
  const kind = mailKindFor(event);
  if (kind && isConfirmationMail(kind)) return kind;
  return event.type === "assessed" && !Object.hasOwn(policy.countryRegions, lead.country) ? "operations" : kind;
}

type MailDelivery = Extract<ForwardingEvent, { type: "mail-delivery" }>;

export function mailRequestsFor(events: ForwardingEvent[], lead: LeadInput, policy?: WorkflowPolicy) {
  const seen = new Set<MailKind>();
  const requests = [];
  for (const event of events) {
    if (event.leadId !== lead.id) continue;
    const kind = mailKindForLead(event, lead, policy);
    if (!kind) continue;
    const first = !seen.has(kind);
    if (event.type === "assessed" && !first) continue;
    seen.add(kind);
    const delivery = events.findLast((item): item is MailDelivery => item.type === "mail-delivery" && item.leadId === lead.id
      && item.kind === kind && (item.causeEventId === event.id || (first && !item.causeEventId)));
    requests.push({ event, kind, delivery });
  }
  return requests;
}
