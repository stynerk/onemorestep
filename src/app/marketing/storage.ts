import { rankedMarketingRequests, type ChannelId } from "../../lib/marketing/policy";
import type { MarketingDraft } from "../../lib/marketing/draft";

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
};

const storageKey = "mirinae:marketing:v1";
const changeEvent = "mirinae:marketing-change";
const requestIds = rankedMarketingRequests.map(({ id }) => id);
const initialState: MarketingState = { order: requestIds, rankChanges: [], channels: {}, drafts: {} };

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
    if (Array.isArray(parsed.order) && parsed.order.length === requestIds.length
        && requestIds.every(id => parsed.order.includes(id)) && Array.isArray(parsed.rankChanges)
        && parsed.rankChanges.every(change => change && typeof change.reason === "string" && Array.isArray(change.rankings)
          && change.rankings.every(row => row && typeof row.id === "string"))
        && parsed.channels && typeof parsed.channels === "object" && parsed.drafts && typeof parsed.drafts === "object"
        && Object.values(parsed.drafts).every(record => record && isMarketingDraft(record.draft)
          && ["검토 대기", "수정됨", "승인됨", "반려됨"].includes(record.status)
          && (record.editedText === undefined || typeof record.editedText === "string")
          && (record.editedTitle === undefined || typeof record.editedTitle === "string"))) return parsed;
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

export function resetMarketingDemo() {
  try {
    window.localStorage.removeItem(storageKey);
    window.dispatchEvent(new Event(changeEvent));
    return true;
  } catch {
    return false;
  }
}
