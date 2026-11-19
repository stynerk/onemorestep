import { rankAvailableDealers } from "./dealers";
import { confirmedCountry, nextBusinessDate } from "./inbox";
import type { ForwardingState, LeadInput, ReassignmentTarget } from "./types";

export function responseClock(state: ForwardingState, realTime: number, simulatedTime: number | null) {
  // Keep accepted future demo assignments and fallback actions in chronological order after a refresh.
  return state.events.reduce((now, event) => event.type === "reassigned" ||
    (event.type === "decision" && event.dealerId !== null)
    ? Math.max(now, Date.parse(event.at)) : now, Math.max(realTime, simulatedTime ?? 0));
}

export function currentDelivery(state: ForwardingState, leadId: string) {
  const dealerId = state.leadStates[leadId]?.dealerId;
  if (!dealerId) return undefined;
  const delivery = state.deliveries.findLast((row) => row.leadId === leadId);
  return delivery?.dealerId === dealerId ? delivery : undefined;
}

export function openAssignment(state: ForwardingState, leadId: string) {
  if (state.leadStates[leadId]?.workflow !== "dealer-assigned") return undefined;
  const delivery = currentDelivery(state, leadId);
  return delivery?.outcome === "in-progress" || delivery?.outcome === "no-response" ? delivery : undefined;
}

export function reassignmentProposal(state: ForwardingState, lead: LeadInput, now: number) {
  const delivery = openAssignment(state, lead.id);
  if (!delivery) return null;
  const deadline = nextBusinessDate(delivery.forwardedAt);
  if (now < Date.parse(deadline)) return null;
  const previous = state.dealers.find((dealer) => dealer.id === delivery.dealerId);
  if (!previous) return null;
  const recommendation = rankAvailableDealers(state, lead, { country: confirmedCountry(state, lead.id) });
  if (recommendation.route === "operations") return null;
  return { delivery, deadline, previous, recommendation };
}

export type ReassignmentProposal = NonNullable<ReturnType<typeof reassignmentProposal>>;

export function reassignmentTarget(proposal: ReassignmentProposal): ReassignmentTarget {
  const recommendation = proposal.recommendation;
  return recommendation.route === "dealer"
    ? { target: "dealer", dealerId: recommendation.ranked[0].dealer.id }
    : { target: recommendation.route, dealerId: null };
}
