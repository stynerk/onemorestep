import { rankAvailableDealers } from "./dealers";
import { flowline } from "./flowline";
import { flowlineSources } from "./flowline-sources";
import { createIndustryState, medicom, regionalHandoffForPolicy, type DemoIndustry, type DemoIndustryOption } from "./industry-demo";
import { classifyLead, classifyLeadWithDomainEvidence, type DomainEvidenceResolver, type SearchEvidence } from "./verdict";
import type { Source } from "../liner-search";
import type { InquiryIntent, LeadInput } from "./types";

type StoredEvidence = { searchedAt: string; sources: Source[] };
export type SavedIndustry = { demo: Extract<DemoIndustry, { id: "b2b-saas" }>; evidence: Readonly<Partial<Record<string, StoredEvidence>>> };

const saasLabels = { id: "b2b-saas", label: "B2B SaaS", brand: "B2B SaaS", dealer: "파트너" } as const;

// Reviewed public excerpts supply the alternate demo's offline assessment input.
const savedIndustries: { "b2b-saas"?: SavedIndustry } = { "b2b-saas": { demo: flowline, evidence: flowlineSources } };
export const demoIndustries: readonly DemoIndustryOption[] = [
  medicom,
  savedIndustries["b2b-saas"]?.demo ?? { ...saasLabels, seed: null, unavailable: "B2B SaaS 시연 데이터 준비 중" },
];

export function getSavedIndustry(id: string): SavedIndustry | undefined {
  return id === "b2b-saas" ? savedIndustries[id] : undefined;
}

function savedSearchEvidence(industry: SavedIndustry, lead: LeadInput): SearchEvidence {
  const evidence = Object.hasOwn(industry.evidence, lead.id) ? industry.evidence[lead.id] : undefined;
  return {
    // Use the frozen classifier's saved-cache input for reviewed public evidence as well as recorded results.
    kind: "cache",
    status: evidence ? "complete" : "saved-unavailable",
    sources: evidence?.sources ?? [],
    searchedAt: evidence?.searchedAt ?? industry.demo.seed.policy.referenceDate,
  };
}

function projectIndustryHandoff(industry: SavedIndustry, lead: LeadInput, regionalCountry: string, result: ReturnType<typeof classifyLead>) {
  const state = createIndustryState(industry.demo);
  const policy = industry.demo.seed.policy;
  let { handoff } = result.assessment;
  if (result.assessment.verdict === "valid") {
    const recommendation = rankAvailableDealers(state, lead);
    handoff = recommendation.route === "dealer"
      ? { kind: "dealer", dealerId: recommendation.ranked[0].dealer.id }
      : regionalHandoffForPolicy({ kind: "regional-sales", region: null }, lead.country, policy);
  } else if (handoff) {
    handoff = regionalHandoffForPolicy(handoff, regionalCountry, policy);
  }
  return { ...result, assessment: { ...result.assessment, handoff } };
}

export function assessSavedIndustryLead(industry: SavedIndustry, lead: LeadInput, regionalCountry = lead.country, intent?: InquiryIntent | null) {
  return projectIndustryHandoff(industry, lead, regionalCountry, classifyLead(lead, savedSearchEvidence(industry, lead), regionalCountry, intent));
}

export async function assessSavedIndustryLeadWithDomainEvidence(
  industry: SavedIndustry, lead: LeadInput, regionalCountry = lead.country, intent?: InquiryIntent | null, domainAdvice?: DomainEvidenceResolver,
) {
  const result = await classifyLeadWithDomainEvidence(lead, savedSearchEvidence(industry, lead), regionalCountry, intent, domainAdvice);
  return projectIndustryHandoff(industry, lead, regionalCountry, result);
}
