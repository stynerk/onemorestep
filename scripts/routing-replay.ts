import { automaticConfirmationFor } from "../src/lib/forwarding/confirmation";
import { forwardingPolicy } from "../src/lib/forwarding/policy";
import type { Assessment, AssessmentHandoff, LeadInput, MemoIntent } from "../src/lib/forwarding/types";

const newRegions = new Set(["스위스", "스페인", "네덜란드", "콜롬비아", "이스라엘"]);
type RoutingAssessment = Pick<Assessment, "verdict" | "details" | "handoff">;
export type HumanReviewReason = "impersonation" | "externalFailure" | "unverifiedPurchase" | "other";

function humanReviewReason(details: Assessment["details"]): HumanReviewReason {
  if (details?.domain === "suspicious") return "impersonation";
  if (details?.externalStatus === "failed") return "externalFailure";
  if (details?.domain === "unverified" && (details.memoIntent === "buying" || details.routerMemoIntent === "buying")) {
    return "unverifiedPurchase";
  }
  return "other";
}

export function routingReplayRow(lead: LeadInput, assessment: RoutingAssessment, routerMemoIntent?: MemoIntent) {
  const { handoff, verdict } = assessment;
  const details = assessment.details && routerMemoIntent
    ? { ...assessment.details, routerMemoIntent }
    : assessment.details;
  let before = handoff;
  if (handoff?.kind === "regional-sales" && newRegions.has(lead.country)) {
    const expected = (forwardingPolicy.countryRegions as Record<string, string>)[lead.country];
    if (!expected || handoff.region !== expected) throw new Error("Unexpected policy handoff for " + lead.id);
    before = { ...handoff, region: null } satisfies AssessmentHandoff;
  }
  const confirmation = automaticConfirmationFor({ verdict, details });
  return { id: lead.id, country: lead.country, verdict, before, after: handoff, confirmation,
    humanReason: verdict === "ambiguous" && !confirmation ? humanReviewReason(details) : null };
}
