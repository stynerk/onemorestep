import { confirmedCountry } from "../forwarding/inbox";
import { forwardingPolicy } from "../forwarding/policy";
import type { ForwardingState, LeadState, Region, Verdict } from "../forwarding/types";
import { campaignEffect, demoAcquisitionForLead, demoCampaigns, type CampaignEffect, type DemoCampaignCode } from "./campaign-policy";
import type { ChannelId } from "./policy";

export type LeadOption = {
  id: string;
  institution: string;
  region: Region | null;
  stage: "없음" | "문의" | "견적";
};

export type CampaignMetrics = {
  code: DemoCampaignCode;
  title: string;
  channel: ChannelId;
  channelLabel: string;
  total: number;
  assessed: number;
  pending: number;
  valid: number;
  validRatio: number | null;
  effect: CampaignEffect;
  dealerCount: number;
  verdicts: Record<Verdict, number>;
};

function dealStage(state: LeadState | undefined): LeadOption["stage"] {
  if (state?.workflow === "dealer-assigned") return "견적";
  if (state?.workflow === "decision-pending" && state.assessment?.verdict === "valid") return "문의";
  return "없음";
}

export function marketingLeadOptions(state: ForwardingState): LeadOption[] {
  const countryRegions: Readonly<Record<string, Region>> = state.policy?.countryRegions ?? forwardingPolicy.countryRegions;
  return state.leads.map((lead) => {
    const country = confirmedCountry(state, lead.id) ?? lead.country;
    const region = Object.hasOwn(countryRegions, country) ? countryRegions[country] : null;
    return { id: lead.id, institution: lead.institution, region, stage: dealStage(state.leadStates[lead.id]) };
  }).sort((left, right) => left.id.localeCompare(right.id));
}

export function marketingCampaignMetrics(state: ForwardingState): CampaignMetrics[] {
  const assigned = new Set(state.events.flatMap((event) => {
    if (event.type === "decision" && event.dealerId && (event.action === "approve" || event.action === "change-dealer")) {
      return [event.leadId];
    }
    return event.type === "reassigned" && event.target === "dealer" ? [event.leadId] : [];
  }));
  return demoCampaigns.map(({ code, title, channel, channelLabel }) => {
    const leads = state.leads.filter((lead) => demoAcquisitionForLead(lead.id)?.code === code);
    const verdicts: Record<Verdict, number> = { valid: 0, ambiguous: 0, "country-check": 0, "partnership-check": 0, invalid: 0 };
    let pending = 0;
    for (const { id } of leads) {
      const verdict = state.leadStates[id]?.assessment?.verdict;
      if (verdict) verdicts[verdict] += 1;
      else pending += 1;
    }
    const total = leads.length;
    const valid = verdicts.valid;
    return {
      code, title, channel, channelLabel, total, assessed: total - pending, pending, valid,
      validRatio: total && pending === 0 ? valid / total : null,
      effect: campaignEffect(total, valid, pending),
      dealerCount: leads.filter(({ id }) => assigned.has(id)).length,
      verdicts,
    };
  });
}
