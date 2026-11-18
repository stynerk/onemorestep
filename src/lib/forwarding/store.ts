import { createInitialForwardingState } from "./seed";
import { VERDICTS, WORKFLOW_STATES } from "./types";
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
function isAssessment(value: unknown): value is Assessment {
  return isObject(value) && exactly(value, ["verdict", "reason", "sources", "searchedAt", "mode"])
    && member(value.verdict, VERDICTS) && isText(value.reason) && Array.isArray(value.sources)
    && value.sources.length <= 20 && value.sources.every(isSource) && isTimestamp(value.searchedAt)
    && member(value.mode, ["live", "saved"]);
}

/** Strict allowlists keep oracle fields, recipient addresses and unknown event payloads out of persistence. */
export function isForwardingEvent(value: unknown, state: ForwardingState): value is ForwardingEvent {
  if (!isObject(value) || !isId(value.id) || !isId(value.leadId) || !isTimestamp(value.at)) return false;
  const common = ["id", "leadId", "at", "type"];
  const leadExists = state.leads.some((lead) => lead.id === value.leadId);
  const dealerExists = (id: unknown) => id === null || state.dealers.some((dealer) => dealer.id === id);
  switch (value.type) {
    case "assessed":
      return leadExists && exactly(value, [...common, "assessment", "workflow"]) && isAssessment(value.assessment) && member(value.workflow, WORKFLOW_STATES);
    case "decision":
      return leadExists && exactly(value, [...common, "action", "dealerId", "reason"])
        && member(value.action, ["approve", "change-dealer", "phone", "disqualify"]) && dealerExists(value.dealerId)
        && isText(value.reason) && (value.action !== "change-dealer" || value.dealerId !== null);
    case "dealer-result": {
      const delivery = state.deliveries.find((row) => row.id === value.deliveryId);
      return exactly(value, [...common, "deliveryId", "dealerId", "outcome"]) && !!delivery
        && delivery.leadId === value.leadId && delivery.dealerId === value.dealerId
        && member(value.outcome, ["deal", "no-deal", "in-progress", "no-response"]);
    }
    case "reply":
      return leadExists && exactly(value, [...common, "kind", "text"])
        && member(value.kind, ["country", "partnership", "manager-confirmation"]) && isText(value.text);
    case "mail-delivery":
      return leadExists && exactly(value, [...common, "mailId", "kind", "recipientKind", "status"])
        && isId(value.mailId) && member(value.kind, ["dealer-summary", "country-check", "partnership-check", "manager-confirmation", "operations"])
        && member(value.recipientKind, ["dealer", "lead", "manager", "operations"])
        && member(value.status, ["sent", "failed", "unknown", "blocked"]);
    default:
      return false;
  }
}

/** Projection only: no assessment, scoring, SMTP, or network calls. */
export function applyForwardingEvent(state: ForwardingState, input: unknown): StoreResult {
  if (!isForwardingEvent(input, state)) return { ok: false, error: "invalid-event", state: structuredClone(state) };
  const existing = state.events.find((event) => event.id === input.id);
  if (existing) {
    // Reusing an ID for different content is a conflict rather than a silently lost action.
    const same = canonical(existing) === canonical(input);
    return { ok: same, duplicate: same || undefined, error: same ? undefined : "invalid-event", state: structuredClone(state) };
  }
  const event = structuredClone(input);
  const next = structuredClone(state);
  const lead = next.leadStates[event.leadId];
  if (event.type === "assessed") {
    lead.assessment = event.assessment;
    // Reassessment cannot revoke a human-approved assignment or completed decision.
    if (!["dealer-assigned", "connected", "disqualified"].includes(lead.workflow)) lead.workflow = event.workflow;
  } else if (event.type === "decision") {
    lead.workflow = event.action === "disqualify" ? "disqualified" : event.action === "phone" ? "decision-pending" : event.dealerId ? "dealer-assigned" : "decision-pending";
    if (event.action === "approve" || event.action === "change-dealer") {
      lead.dealerId = event.dealerId;
      if (event.dealerId) {
        const inputLead = next.leads.find((row) => row.id === event.leadId)!;
        next.deliveries.push({ id: `delivery:${event.id}`, dealerId: event.dealerId, leadId: event.leadId, institution: inputLead.institution, forwardedAt: event.at, outcome: "in-progress" });
      }
    }
  } else if (event.type === "dealer-result") {
    const delivery = next.deliveries.find((row) => row.id === event.deliveryId)!;
    delivery.outcome = event.outcome;
    if (lead && lead.dealerId === event.dealerId && (event.outcome === "deal" || event.outcome === "no-deal")) lead.workflow = "connected";
  } else if (event.type === "reply") {
    if (!["dealer-assigned", "connected", "disqualified"].includes(lead.workflow)) lead.workflow = "decision-pending";
  }
  next.events.push(event);
  return { ok: true, state: next };
}

function decode(raw: string): ForwardingState | null {
  try {
    if (raw.length > 2_000_000) return null;
    const value: unknown = JSON.parse(raw);
    if (!isObject(value) || !exactly(value, ["version", "events"]) || value.version !== FORWARDING_STORAGE_VERSION || !Array.isArray(value.events) || value.events.length > 10_000) return null;
    let state = createInitialForwardingState();
    for (const event of value.events) {
      const result = applyForwardingEvent(state, event);
      if (!result.ok) return null;
      state = result.state;
    }
    return state;
  } catch { return null; }
}

/** Single-user event persistence. Callers display errors; rejected writes never change the committed snapshot. */
export function createForwardingStore(storage: StorageAdapter | null) {
  let state = createInitialForwardingState();
  let hydrated = false;
  const result = (ok: boolean, error?: StoreFailure): StoreResult => ({ ok, error, state: structuredClone(state) });
  const hydrate = (): StoreResult => {
    hydrated = false;
    if (!storage) return result(false, "storage-unavailable");
    let raw: string | null;
    try { raw = storage.getItem(FORWARDING_STORAGE_KEY); } catch { return result(false, "storage-read-failed"); }
    if (raw === null) { state = createInitialForwardingState(); hydrated = true; return result(true); }
    const restored = decode(raw);
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
      try { storage.setItem(FORWARDING_STORAGE_KEY, encoded); } catch { return result(false, "storage-write-failed"); }
      state = applied.state;
      return result(true);
    },
    reset(): StoreResult {
      if (!storage) return result(false, "storage-unavailable");
      try { storage.removeItem(FORWARDING_STORAGE_KEY); } catch { return result(false, "storage-write-failed"); }
      state = createInitialForwardingState();
      hydrated = true;
      return result(true);
    },
  };
}

/** SSR-safe: accessing localStorage can itself throw when browser storage is blocked. */
export function createBrowserForwardingStore() {
  let storage: StorageAdapter | null = null;
  try { if (typeof window !== "undefined") storage = window.localStorage; } catch { /* Report unavailable through the store result. */ }
  return createForwardingStore(storage);
}
