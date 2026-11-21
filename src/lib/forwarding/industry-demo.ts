import { handoffForLead } from "./handoff";
import { confirmedCountry, inboxBucket } from "./inbox";
import { createInitialForwardingState } from "./seed";
import type { AssessmentHandoff, ForwardingState, LeadInput, WorkflowPolicy } from "./types";

type IndustryLabels = { label: string; brand: string; dealer: string };
export type IndustrySeed = Pick<ForwardingState, "leads" | "dealers" | "deliveries" | "priorRelationships"> & {
  policy: WorkflowPolicy;
};
type Medicom = IndustryLabels & { id: "medicom" };
type SaaS = IndustryLabels & { id: "b2b-saas"; seed: IndustrySeed };
export type DemoIndustry = Medicom | SaaS;
export type DemoIndustryOption = DemoIndustry | (IndustryLabels & { id: "b2b-saas"; seed: null; unavailable: string });

export const medicom: Medicom = { id: "medicom", label: "의료기기(Medicom)", brand: "MEDICOM", dealer: "딜러" };

export function isAvailableIndustry(option: DemoIndustryOption): option is DemoIndustry {
  return option.id === "medicom" || option.seed !== null;
}

export function createIndustryState(demo: DemoIndustry = medicom): ForwardingState {
  if (demo.id === "medicom") return createInitialForwardingState();
  const seed = structuredClone(demo.seed);
  return {
    ...seed,
    leadStates: Object.fromEntries(seed.leads.map((lead) => [
      lead.id, { leadId: lead.id, assessment: null, workflow: "new", dealerId: null },
    ])),
    events: [],
  };
}

export function regionalHandoffForPolicy(
  handoff: AssessmentHandoff, country: string, policy: WorkflowPolicy | undefined,
): AssessmentHandoff {
  if (handoff.kind !== "regional-sales" || !policy) return handoff;
  return { kind: "regional-sales", region: Object.hasOwn(policy.countryRegions, country) ? policy.countryRegions[country] : null };
}

export function industryHandoffForLead(state: ForwardingState, lead: LeadInput) {
  const handoff = handoffForLead(state, lead);
  if (!handoff || !state.policy) return handoff;
  const country = inboxBucket(state, lead) === "valid" ? confirmedCountry(state, lead.id) ?? lead.country : lead.country;
  return regionalHandoffForPolicy(handoff, country, state.policy);
}
