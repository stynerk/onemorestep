import { rankAvailableDealers, recommendDealer, type DealerRecommendation } from "./dealers";
import { confirmedCountry, inboxBucket } from "./inbox";
import { forwardingPolicy } from "./policy";
import { createInitialForwardingState } from "./seed";
import type { AssessmentHandoff, ForwardingState, LeadInput, MemoIntent, Region, Verdict } from "./types";

const dealerBaseline = createInitialForwardingState();
const regions: Readonly<Record<string, Region>> = forwardingPolicy.countryRegions;

export function regionalSalesHandoff(country: string): Extract<AssessmentHandoff, { kind: "regional-sales" }> {
  return { kind: "regional-sales", region: Object.hasOwn(regions, country) ? regions[country] : null };
}

function dealerHandoff(recommendation: DealerRecommendation | null, country: string): AssessmentHandoff {
  if (recommendation?.route === "assigned") return { kind: "dealer", dealerId: recommendation.dealerId };
  if (recommendation?.route === "dealer") return { kind: "dealer", dealerId: recommendation.ranked[0].dealer.id };
  return regionalSalesHandoff(country);
}

export function handoffForAssessment(
  lead: LeadInput,
  verdict: Verdict,
  memoIntent: MemoIntent | undefined,
  regionalCountry: string = lead.country,
): AssessmentHandoff {
  if (verdict === "invalid") return { kind: memoIntent === "job" ? "hr" : "none" };
  if (verdict === "valid") return dealerHandoff(rankAvailableDealers(dealerBaseline, lead), lead.country);
  return regionalSalesHandoff(regionalCountry);
}

/** Reproject from browser history so legacy records and changing dealer scores remain usable. */
export function handoffForLead(state: ForwardingState, lead: LeadInput): AssessmentHandoff | null {
  const status = state.leadStates[lead.id];
  if (!status) return null;
  if (status.dealerId) return { kind: "dealer", dealerId: status.dealerId };
  const verdict = inboxBucket(state, lead);
  if (!verdict) return null;
  if (verdict === "valid") {
    const country = confirmedCountry(state, lead.id) ?? lead.country;
    return dealerHandoff(recommendDealer(state, lead.id, { country }), country);
  }
  if (verdict === "invalid" && status.assessment?.handoff?.kind === "hr") return status.assessment.handoff;
  return handoffForAssessment(lead, verdict, status.assessment?.details?.memoIntent);
}
