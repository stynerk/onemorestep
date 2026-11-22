import { locales } from "./institution-policy";
import { regionalSalesHandoff } from "./handoff";
import { createIndustryState, medicom, regionalHandoffForPolicy, type DemoIndustry } from "./industry-demo";
import { mailKindForLead } from "./inbox";
import { openAssignment, reassignmentProposal, reassignmentTarget } from "./reassignment";
import { DOMAIN_CHECKS, EXTERNAL_STATUSES, MEMO_INTENTS, REGIONS, SOURCE_KINDS, VERDICTS, WORKFLOW_STATES } from "./types";
import type { Assessment, ForwardingEvent, ForwardingState } from "./types";

export const FORWARDING_STORAGE_KEY = "mirinae.forwarding.v1";
export const FORWARDING_STORAGE_VERSION = 1;

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
export type StoreFailure = "storage-unavailable" | "storage-read-failed" | "invalid-saved-data" | "storage-write-failed" | "invalid-event";
export interface StoreResult {
  ok: boolean;
  state: ForwardingState;
  error?: StoreFailure;
  duplicate?: boolean;
}
interface Envelope { version: 1; events: ForwardingEvent[] }

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isText = (value: unknown, maximum = 4000): value is string => typeof value === "string" && value.length <= maximum;
const isId = (value: unknown): value is string => typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9:_.-]{0,119}$/.test(value);
const isTimestamp = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const exactly = (value: Record<string, unknown>, fields: string[]) => Object.keys(value).length === fields.length && fields.every((field) => Object.hasOwn(value, field));
const member = (value: unknown, options: readonly string[]): value is string => typeof value === "string" && options.includes(value);
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (isObject(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
const isSource = (value: unknown): value is string => {
  if (!isText(value, 2000)) return false;
  try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
};
function isHandoff(value: unknown, verdict: unknown, state: ForwardingState) {
  if (!isObject(value)) return false;
  switch (value.kind) {
    case "dealer":
      return verdict === "valid" && exactly(value, ["kind", "dealerId"]) && state.dealers.some((dealer) => dealer.id === value.dealerId);
    case "regional-sales":
      return verdict !== "invalid" && exactly(value, ["kind", "region"])
        && (value.region === null || member(value.region, REGIONS));
    case "hr":
    case "none":
      return verdict === "invalid" && exactly(value, ["kind"]);
    default:
      return false;
  }
}

function isAssessment(value: unknown, state: ForwardingState): value is Assessment {
  if (!isObject(value)) return false;
  const fields = ["verdict", "reason", "sources", "searchedAt", "mode"];
  if (Object.hasOwn(value, "handoff")) {
    fields.push("handoff");
    if (!isHandoff(value.handoff, value.verdict, state)) return false;
  }
  if (Object.hasOwn(value, "details")) {
    fields.push("details");
    const details = value.details;
    if (!isObject(details)) return false;
    const detailFields = ["domain", "countries", "industry", "memoIntent", "memoQuote", "externalStatus", "sourceKind"];
    if (Object.hasOwn(details, "memoSource")) {
      if (details.memoSource !== "liner" || !isText(details.memoQuote, 200) || !details.memoQuote.trim()) return false;
      detailFields.push("memoSource");
    }
    if (!exactly(details, detailFields) || !member(details.domain, DOMAIN_CHECKS) || !member(details.memoIntent, MEMO_INTENTS)
      || !member(details.externalStatus, EXTERNAL_STATUSES) || !member(details.sourceKind, SOURCE_KINDS)
      || !Array.isArray(details.countries) || details.countries.length > 20 || !details.countries.every((country) => isText(country, 80))
      || !(details.industry === null || isText(details.industry, 80))
      || !(details.memoQuote === null || isText(details.memoQuote, 200))) return false;
  }
  return exactly(value, fields)
    && member(value.verdict, VERDICTS) && isText(value.reason) && Array.isArray(value.sources)
    && value.sources.length <= 20 && value.sources.every(isSource) && isTimestamp(value.searchedAt)
    && member(value.mode, ["live", "saved"]);
}

/** Strict allowlists keep oracle fields, recipient addresses and unknown event payloads out of persistence. */
export function isForwardingEvent(value: unknown, state: ForwardingState): value is ForwardingEvent {
  if (!isObject(value) || !isId(value.id) || !isId(value.leadId) || !isTimestamp(value.at)) return false;
  const common = ["id", "leadId", "at", "type"];
  const lead = state.leads.find((lead) => lead.id === value.leadId);
  const leadExists = lead !== undefined;
  const dealerExists = (id: unknown) => id === null || state.dealers.some((dealer) => dealer.id === id);
  switch (value.type) {
    case "assessed":
      return leadExists && exactly(value, [...common, "assessment", "workflow"]) && isAssessment(value.assessment, state) && member(value.workflow, WORKFLOW_STATES);
    case "decision":
      return leadExists && exactly(value, [...common, "action", "dealerId", "reason"])
        && member(value.action, ["approve", "change-dealer", "phone", "disqualify"]) && dealerExists(value.dealerId)
        && isText(value.reason) && (value.action !== "change-dealer" || value.dealerId !== null);
    case "reassigned":
      // The mail route checks shape against the seed. The browser store checks assignment lineage.
      return leadExists && exactly(value, [...common, "previousDeliveryId", "target", "dealerId"])
        && typeof value.previousDeliveryId === "string" && /^delivery:[a-zA-Z0-9][a-zA-Z0-9:_.-]{0,119}$/.test(value.previousDeliveryId)
        && (value.target === "dealer" ? isId(value.dealerId) && dealerExists(value.dealerId)
          : (value.target === "manager-confirmation" || value.target === "manager-direct") && value.dealerId === null);
    case "dealer-result": {
      const delivery = state.deliveries.find((row) => row.id === value.deliveryId);
      return exactly(value, [...common, "deliveryId", "dealerId", "outcome"]) && !!delivery
        && delivery.leadId === value.leadId && delivery.dealerId === value.dealerId
        && member(value.outcome, ["deal", "no-deal", "in-progress", "no-response"]);
    }
    case "reply": {
      const fields = [...common, "kind", "text"];
      if (Object.hasOwn(value, "selection")) {
        fields.push("selection");
        if (typeof value.selection !== "string") return false;
        if (value.kind === "country" && !Object.hasOwn(locales, value.selection)) return false;
        if (value.kind === "partnership" && !["purchase", "partnership"].includes(value.selection)) return false;
        if (value.kind === "manager-confirmation" && !dealerExists(value.selection)) return false;
      }
      return leadExists && exactly(value, fields)
        && member(value.kind, ["country", "partnership", "manager-confirmation"]) && isText(value.text);
    }
    case "review-reopened":
      return leadExists && exactly(value, common);
    case "mail-delivery": {
      const fields = [...common, "mailId", "kind", "recipientKind", "status"];
      if (Object.hasOwn(value, "causeEventId")) {
        fields.push("causeEventId");
        if (!lead || !isId(value.causeEventId) || !state.events.some((event) =>
          event.id === value.causeEventId && event.leadId === lead.id && mailKindForLead(event, lead, state.policy) === value.kind)) return false;
      }
      return leadExists && exactly(value, fields)
        && isId(value.mailId) && member(value.kind, ["dealer-summary", "country-check", "partnership-check", "manager-confirmation", "operations"])
        && member(value.recipientKind, ["dealer", "lead", "manager", "operations"])
        && member(value.status, ["sent", "failed", "unknown", "blocked"]);
    }
    default:
      return false;
  }
}

/** Validate a new action against the current assignment and policy before projection. */
export function applyForwardingEvent(state: ForwardingState, input: unknown): StoreResult {
  return projectEvent(state, input, true);
}

function projectEvent(state: ForwardingState, input: unknown, validateProposal: boolean): StoreResult {
  if (!isForwardingEvent(input, state)) return { ok: false, error: "invalid-event", state: structuredClone(state) };
  const existing = state.events.find((event) => event.id === input.id);
  if (existing) {
    // Reusing an ID for different content is a conflict rather than a silently lost action.
    const same = canonical(existing) === canonical(input);
    return { ok: same, duplicate: same || undefined, error: same ? undefined : "invalid-event", state: structuredClone(state) };
  }
  if (input.type === "review-reopened") {
    const status = state.leadStates[input.leadId];
    if (status.dealerId || (status.assessment?.verdict !== "invalid" && status.workflow !== "disqualified")) {
      return { ok: false, error: "invalid-event", state: structuredClone(state) };
    }
  }
  if (input.type === "reassigned") {
    const previous = openAssignment(state, input.leadId);
    if (previous?.id !== input.previousDeliveryId || input.at < previous.forwardedAt
      || state.deliveries.some((row) => row.leadId === input.leadId && row.dealerId === input.dealerId)) {
      return { ok: false, error: "invalid-event", state: structuredClone(state) };
    }
    // Replay the accepted choice even if the deadline or ranking policy has changed.
    if (validateProposal) {
      const lead = state.leads.find((row) => row.id === input.leadId)!;
      const proposal = reassignmentProposal(state, lead, Date.parse(input.at));
      const target = proposal && reassignmentTarget(proposal);
      if (!target || target.target !== input.target || target.dealerId !== input.dealerId) {
        return { ok: false, error: "invalid-event", state: structuredClone(state) };
      }
    }
  } else if (input.type === "dealer-result" && state.events.some((event) =>
    event.type === "reassigned" && event.previousDeliveryId === input.deliveryId)) {
    return { ok: false, error: "invalid-event", state: structuredClone(state) };
  }
  const event = structuredClone(input);
  const next = structuredClone(state);
  const lead = next.leadStates[event.leadId];
  if (event.type === "assessed") {
    lead.assessment = event.assessment;
    // Reassessment cannot revoke a human-approved assignment or completed decision.
    if (!["dealer-assigned", "connected", "disqualified", "manager-direct-pending"].includes(lead.workflow)) lead.workflow = event.workflow;
  } else if (event.type === "decision") {
    lead.workflow = event.action === "disqualify" ? "disqualified" : event.action === "phone" ? "decision-pending" : event.dealerId ? "dealer-assigned" : "decision-pending";
    if (event.action === "approve" || event.action === "change-dealer") {
      lead.dealerId = event.dealerId;
      if (event.dealerId) {
        const inputLead = next.leads.find((row) => row.id === event.leadId)!;
        next.deliveries.push({ id: `delivery:${event.id}`, dealerId: event.dealerId, leadId: event.leadId, institution: inputLead.institution, forwardedAt: event.at, outcome: "in-progress" });
      }
    }
  } else if (event.type === "reassigned") {
    const previous = next.deliveries.find((row) => row.id === event.previousDeliveryId)!;
    previous.outcome = "no-response";
    lead.dealerId = event.dealerId;
    if (event.target === "dealer") {
      lead.workflow = "dealer-assigned";
      next.deliveries.push({ ...previous, id: `delivery:${event.id}`, dealerId: event.dealerId, forwardedAt: event.at, outcome: "in-progress" });
    } else {
      lead.workflow = event.target === "manager-confirmation" ? "manager-confirmation-pending" : "manager-direct-pending";
    }
  } else if (event.type === "dealer-result") {
    const delivery = next.deliveries.find((row) => row.id === event.deliveryId)!;
    delivery.outcome = event.outcome;
    if (lead && lead.dealerId === event.dealerId && (event.outcome === "deal" || event.outcome === "no-deal")) lead.workflow = "connected";
  } else if (event.type === "reply") {
    if (!["dealer-assigned", "connected", "disqualified"].includes(lead.workflow)) lead.workflow = "decision-pending";
  } else if (event.type === "review-reopened") {
    const country = next.leads.find((row) => row.id === event.leadId)?.country ?? "";
    lead.assessment = lead.assessment
      ? { ...lead.assessment, verdict: "ambiguous", reason: "무효 묶음에서 꺼냈어요. 다시 확인해 주세요.",
        handoff: regionalHandoffForPolicy(regionalSalesHandoff(country), country, next.policy) }
      : null;
    lead.workflow = "decision-pending";
  }
  next.events.push(event);
  return { ok: true, state: next };
}

function decode(raw: string, demo: DemoIndustry): ForwardingState | null {
  try {
    if (raw.length > 2_000_000) return null;
    const value: unknown = JSON.parse(raw);
    if (!isObject(value) || !exactly(value, ["version", "events"]) || value.version !== FORWARDING_STORAGE_VERSION || !Array.isArray(value.events) || value.events.length > 10_000) return null;
    let state = createIndustryState(demo);
    for (const event of value.events) {
      const result = projectEvent(state, event, false);
      if (!result.ok) return null;
      state = result.state;
    }
    return state;
  } catch { return null; }
}

/** Single-user event persistence. Callers display errors; rejected writes never change the committed snapshot. */
export function createForwardingStore(storage: StorageAdapter | null, demo: DemoIndustry = medicom) {
  const storageKey = demo.id === "medicom" ? FORWARDING_STORAGE_KEY : `${FORWARDING_STORAGE_KEY}.${demo.id}`;
  let state = createIndustryState(demo);
  let hydrated = false;
  const result = (ok: boolean, error?: StoreFailure): StoreResult => ({ ok, error, state: structuredClone(state) });
  const hydrate = (): StoreResult => {
    hydrated = false;
    if (!storage) return result(false, "storage-unavailable");
    let raw: string | null;
    try { raw = storage.getItem(storageKey); } catch { return result(false, "storage-read-failed"); }
    if (raw === null) { state = createIndustryState(demo); hydrated = true; return result(true); }
    const restored = decode(raw, demo);
    if (!restored) return result(false, "invalid-saved-data");
    state = restored;
    hydrated = true;
    return result(true);
  };
  return {
    snapshot: (): ForwardingState => structuredClone(state),
    hydrate,
    append(event: unknown): StoreResult {
      // A fresh consumer must not accidentally overwrite earlier events before reading them.
      if (!hydrated) {
        const loaded = hydrate();
        if (!loaded.ok) return loaded;
      }
      const applied = applyForwardingEvent(state, event);
      if (!applied.ok || applied.duplicate) return applied;
      if (!storage) return result(false, "storage-unavailable");
      if (applied.state.events.length > 10_000) return result(false, "invalid-event");
      const envelope: Envelope = { version: 1, events: applied.state.events };
      const encoded = JSON.stringify(envelope);
      if (encoded.length > 2_000_000) return result(false, "invalid-event");
      try { storage.setItem(storageKey, encoded); } catch { return result(false, "storage-write-failed"); }
      state = applied.state;
      return result(true);
    },
    reset(): StoreResult {
      if (!storage) return result(false, "storage-unavailable");
      try { storage.removeItem(storageKey); } catch { return result(false, "storage-write-failed"); }
      state = createIndustryState(demo);
      hydrated = true;
      return result(true);
    },
  };
}

/** SSR-safe: accessing localStorage can itself throw when browser storage is blocked. */
export function createBrowserForwardingStore(demo: DemoIndustry = medicom) {
  let storage: StorageAdapter | null = null;
  try { if (typeof window !== "undefined") storage = window.localStorage; } catch { /* Report unavailable through the store result. */ }
  return createForwardingStore(storage, demo);
}
