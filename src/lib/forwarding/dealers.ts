import { forwardingPolicy } from "./policy";
import type { StoreResult } from "./store";
import type { Dealer, DealerDelivery, DealerOutcome, ForwardingEvent, ForwardingState, LeadInput, WorkflowPolicy } from "./types";

type Manager = WorkflowPolicy["managers"][number];
type ScoringWindow = { days: number; from: string; through: string };

export interface DealerScore {
  dealer: Dealer;
  deliveries: DealerDelivery[];
  forwarded: number;
  closed: number;
  deals: number;
  noDeals: number;
  inProgress: number;
  noResponse: number;
  conversionRate: number | null;
  lowHistory: boolean;
  priorRelationship: boolean;
  noResponsePenalty: number;
  relationshipBonus: number;
  score: number | null;
}

export type DealerRecommendation =
  | { route: "assigned"; dealerId: string }
  | { route: "operations"; country: string }
  | { route: "not-eligible" }
  | { route: "manager-direct"; manager: Manager }
  | { route: "manager-confirmation"; manager: Manager; candidates: DealerScore[]; window: ScoringWindow }
  | {
    route: "dealer";
    manager: Manager;
    ranked: (DealerScore & { score: number })[];
    unranked: DealerScore[];
    window: ScoringWindow;
  };

type RecommendationOptions = {
  /** Country confirmed by a reply, if available. */
  country?: string;
  /** Use an explicit point in time for reproduction or a caller's live clock. */
  asOf?: Date;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const compareNames = (left: DealerScore, right: DealerScore) =>
  left.dealer.name.localeCompare(right.dealer.name, "en") || left.dealer.id.localeCompare(right.dealer.id, "en");

function getManager(country: string, { countryRegions, managers }: WorkflowPolicy) {
  if (!Object.hasOwn(countryRegions, country)) return undefined;
  return managers.find((manager) => manager.region === countryRegions[country]);
}

function getWindowEnd(state: ForwardingState, asOf: Date | undefined) {
  if (asOf) return asOf.getTime();
  // Keep the synthetic history reproducible and include approvals recorded after the seed date.
  return state.deliveries.reduce(
    (latest, delivery) => Math.max(latest, Date.parse(delivery.forwardedAt)),
    Date.parse((state.policy ?? forwardingPolicy).referenceDate),
  );
}

export function dealerScore(state: ForwardingState, lead: LeadInput, dealer: Dealer): DealerScore {
  const through = getWindowEnd(state, undefined);
  const policy = state.policy ?? forwardingPolicy;
  return scoreDealer(dealer, lead, state, firstDay(through, policy.aggregationDays), through, policy);
}

function firstDay(through: number, aggregationDays: number) {
  // Whole UTC dates keep same-day slips from dropping an earlier delivery.
  return (Math.floor(through / DAY_MS) - aggregationDays) * DAY_MS;
}

function scoreDealer(dealer: Dealer, lead: LeadInput, state: ForwardingState, from: number, through: number, policy: WorkflowPolicy): DealerScore {
  const deliveries: DealerDelivery[] = [];
  const counts: Record<DealerOutcome, number> = { deal: 0, "no-deal": 0, "in-progress": 0, "no-response": 0 };
  const sameInstitution = (institution: string) => institution === lead.institution;
  let priorRelationship = state.priorRelationships.some((row) => row.dealerId === dealer.id && sameInstitution(row.institution));

  for (const delivery of state.deliveries) {
    if (delivery.dealerId !== dealer.id) continue;
    const forwarded = Date.parse(delivery.forwardedAt);
    if (forwarded > through) continue;
    if (delivery.outcome === "deal" && sameInstitution(delivery.institution)) priorRelationship = true;
    if (forwarded >= from) {
      counts[delivery.outcome] += 1;
      deliveries.push(delivery);
    }
  }

  const deals = counts.deal;
  const noDeals = counts["no-deal"];
  const inProgress = counts["in-progress"];
  const noResponse = counts["no-response"];
  const closed = deals + noDeals;
  const forwarded = closed + inProgress + noResponse;
  const conversionRate = closed === 0 ? null : deals / closed;
  const lowHistory = forwarded < policy.minimumForwardedCount;
  const noResponsePenalty = noResponse === 0 ? 0 : noResponse * policy.weights.noResponse;
  const relationshipBonus = priorRelationship ? policy.weights.priorRelationship : 0;
  // Round beyond the display precision so mathematically equal scores reach the tie-breakers.
  const score = lowHistory || conversionRate === null
    ? null
    : Number((conversionRate + noResponsePenalty + relationshipBonus).toFixed(12));

  return {
    dealer, deliveries, forwarded, closed, deals, noDeals, inProgress, noResponse,
    conversionRate, lowHistory, priorRelationship, noResponsePenalty, relationshipBonus, score,
  };
}

/** Project recommendations from the current event snapshot so pending cards update after each result. */
export function recommendDealer(state: ForwardingState, leadId: string, options: RecommendationOptions = {}): DealerRecommendation | null {
  const lead = state.leads.find((row) => row.id === leadId);
  if (!lead) return null;
  const status = state.leadStates[leadId];
  if (status.dealerId) return { route: "assigned", dealerId: status.dealerId };
  const country = options.country ?? lead.country;
  // Missing region is an operations alert independent of the lead verdict.
  if (!getManager(country, state.policy ?? forwardingPolicy)) return { route: "operations", country };
  if (status.assessment?.verdict !== "valid" || status.workflow === "disqualified") return { route: "not-eligible" };
  return rankAvailableDealers(state, lead, options);
}

/** Rank only eligible dealers that have yet to receive this lead. */
export function rankAvailableDealers(state: ForwardingState, lead: LeadInput, options: RecommendationOptions = {}): Exclude<DealerRecommendation, { route: "assigned" | "not-eligible" }> {
  const country = options.country ?? lead.country;
  const policy = state.policy ?? forwardingPolicy;
  const manager = getManager(country, policy);
  if (!manager) return { route: "operations", country } as const;
  const attempted = new Set(state.deliveries.filter((delivery) => delivery.leadId === lead.id).map((delivery) => delivery.dealerId));
  const eligible = state.dealers.filter((dealer) => dealer.active && dealer.countries.includes(country)
    && dealer.products.includes(lead.product) && !attempted.has(dealer.id));
  if (eligible.length === 0) return { route: "manager-direct", manager };

  const through = getWindowEnd(state, options.asOf);
  const from = firstDay(through, policy.aggregationDays);
  const window = { days: policy.aggregationDays, from: new Date(from).toISOString(), through: new Date(through).toISOString() };
  const candidates = eligible.map((dealer) => scoreDealer(dealer, lead, state, from, through, policy));
  const ranked = candidates.filter((candidate): candidate is DealerScore & { score: number } => candidate.score !== null)
    .sort((left, right) => right.score - left.score || right.deals - left.deals || compareNames(left, right));
  const unranked = candidates.filter((candidate) => candidate.score === null).sort(compareNames);
  if (ranked.length === 0) return { route: "manager-confirmation", manager, candidates: unranked, window };
  return { route: "dealer", manager, ranked, unranked, window };
}

type DealerResultInput = {
  id: string;
  at: string;
  delivery: Pick<DealerDelivery, "id" | "dealerId" | "leadId">;
  outcome: Exclude<DealerOutcome, "in-progress">;
};

/** Use the store's existing validation, idempotency and replay for both current and historical deliveries. */
export function recordDealerOutcome(store: { append(event: ForwardingEvent): StoreResult }, input: DealerResultInput): StoreResult {
  return store.append({
    id: input.id,
    at: input.at,
    type: "dealer-result",
    deliveryId: input.delivery.id,
    dealerId: input.delivery.dealerId,
    leadId: input.delivery.leadId,
    outcome: input.outcome,
  });
}
