export const VERDICTS = ["valid", "ambiguous", "country-check", "partnership-check", "invalid"] as const;
export type Verdict = (typeof VERDICTS)[number];
export const WORKFLOW_STATES = ["new", "decision-pending", "reply-pending", "manager-confirmation-pending", "manager-direct-pending", "dealer-assigned", "connected", "disqualified"] as const;
export type WorkflowState = (typeof WORKFLOW_STATES)[number];
export type Product = "PM-50" | "US-200" | "IS-3";
export const REGIONS = ["NA", "LATAM", "APAC", "EU", "MEA"] as const;
export type Region = (typeof REGIONS)[number];
export type DealerOutcome = "deal" | "no-deal" | "in-progress" | "no-response";

/** Operational input only. Evaluation labels and real/fictional markers are deliberately absent. */
export interface LeadInput {
  id: string;
  name: string;
  email: string;
  phone: string;
  institution: string;
  country: string;
  product: string;
  memo: string;
  receivedAt: string;
}
export interface Dealer {
  id: string;
  name: string;
  countries: string[];
  products: string[];
  active: boolean;
}
export interface DealerDelivery {
  id: string;
  dealerId: string;
  leadId: string;
  institution: string;
  forwardedAt: string;
  outcome: DealerOutcome;
}
export interface PriorRelationship {
  dealerId: string;
  institution: string;
}
export const MEMO_INTENTS = ["buying", "partnership", "job", "student", "sales", "spam", "unknown"] as const;
export type MemoIntent = (typeof MEMO_INTENTS)[number];
export type InquiryIntent = { intent: MemoIntent; quote: string };
export const DOMAIN_CHECKS = ["matched", "free-email", "suspicious", "unverified"] as const;
export const EXTERNAL_STATUSES = ["complete", "failed", "saved-unavailable", "not-needed"] as const;
export const SOURCE_KINDS = ["liner", "cache", "mixed", "curated", "local"] as const;

export interface AssessmentDetails {
  domain: (typeof DOMAIN_CHECKS)[number];
  countries: string[];
  industry: string | null;
  memoIntent: MemoIntent;
  memoQuote: string | null;
  memoSource?: "liner";
  externalStatus: (typeof EXTERNAL_STATUSES)[number];
  sourceKind: (typeof SOURCE_KINDS)[number];
}

export type AssessmentHandoff =
  | { kind: "dealer"; dealerId: string }
  | { kind: "regional-sales"; region: Region | null }
  | { kind: "hr" }
  | { kind: "none" };

export interface Assessment {
  verdict: Verdict;
  reason: string;
  sources: string[];
  searchedAt: string;
  mode: "live" | "saved";
  details?: AssessmentDetails;
  // Earlier version-1 browser events were written before the handoff field existed.
  handoff?: AssessmentHandoff;
}
export interface LeadState {
  leadId: string;
  assessment: Assessment | null;
  workflow: WorkflowState;
  dealerId: string | null;
}
export type DecisionAction = "approve" | "change-dealer" | "phone" | "disqualify";
export type ReplyKind = "country" | "partnership" | "manager-confirmation";
export type MailKind = "dealer-summary" | "country-check" | "partnership-check" | "manager-confirmation" | "operations";
export type RecipientKind = "dealer" | "lead" | "manager" | "operations";
export type MailStatus = "sent" | "failed" | "unknown" | "blocked";
export type ReassignmentTarget =
  | { target: "dealer"; dealerId: string }
  | { target: "manager-confirmation" | "manager-direct"; dealerId: null };
interface EventBase { id: string; leadId: string; at: string }
export type ForwardingEvent =
  | (EventBase & { type: "assessed"; assessment: Assessment; workflow: WorkflowState })
  | (EventBase & { type: "decision"; action: DecisionAction; dealerId: string | null; reason: string })
  | (EventBase & { type: "reassigned"; previousDeliveryId: string } & ReassignmentTarget)
  | (EventBase & { type: "dealer-result"; deliveryId: string; dealerId: string; outcome: DealerOutcome })
  | (EventBase & { type: "reply"; kind: ReplyKind; text: string; selection?: string })
  | (EventBase & { type: "review-reopened" })
  | (EventBase & { type: "mail-delivery"; mailId: string; kind: MailKind; recipientKind: RecipientKind; status: MailStatus; causeEventId?: string });

export interface WorkflowPolicy {
  aggregationDays: number;
  minimumForwardedCount: number;
  responseBusinessDays: number;
  responseTimeZone: "Asia/Seoul";
  weights: { noResponse: number; priorRelationship: number };
  referenceDate: string;
  countryRegions: Readonly<Record<string, Region>>;
  managers: readonly { id: string; name: string; region: Region }[];
  customerIndustries?: Readonly<Record<string, readonly string[]>>;
}

export interface ForwardingState {
  policy?: WorkflowPolicy;
  leads: LeadInput[];
  dealers: Dealer[];
  deliveries: DealerDelivery[];
  priorRelationships: PriorRelationship[];
  leadStates: Record<string, LeadState>;
  events: ForwardingEvent[];
}
