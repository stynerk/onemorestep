import { automaticConfirmationFor } from "../src/lib/forwarding/confirmation";
import { forwardingPolicy } from "../src/lib/forwarding/policy";
import type { AssessmentHandoff, Assessment, LeadInput } from "../src/lib/forwarding/types";

const newRegions = new Set(["스위스", "스페인", "네덜란드", "콜롬비아", "이스라엘"]);
type RoutingAssessment = Pick<Assessment, "verdict" | "reason" | "details" | "handoff">;

export function routingReplayRow(lead: LeadInput, assessment: RoutingAssessment) {
  const { handoff, verdict } = assessment;
  let before = handoff;
  if (handoff?.kind === "regional-sales" && newRegions.has(lead.country)) {
    const expected = (forwardingPolicy.countryRegions as Record<string, string>)[lead.country];
    if (!expected || handoff.region !== expected) throw new Error("Unexpected policy handoff for " + lead.id);
    before = { ...handoff, region: null } satisfies AssessmentHandoff;
  }
  return { id: lead.id, country: lead.country, verdict, before, after: handoff, confirmation: automaticConfirmationFor(assessment, lead) };
}
