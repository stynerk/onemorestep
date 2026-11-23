import type { ChannelId } from "./policy";

export type DemoCampaignCode = "C1" | "C2" | "C3" | "C4";
export type AcquisitionCode = DemoCampaignCode | "direct";
export type CampaignEffect = "판정 전" | "판단 보류" | "효과 높음" | "보통" | "효과 낮음";

type DemoCampaign = {
  code: DemoCampaignCode;
  title: string;
  channel: ChannelId;
  channelLabel: string;
  leadIds: readonly string[];
};

export const demoCampaigns: readonly DemoCampaign[] = [
  { code: "C1", title: "PM-50 병원 교체 사례", channel: "linkedin", channelLabel: "LinkedIn", leadIds: ["L01", "L02", "L06", "L09", "L12"] },
  { code: "C2", title: "신제품 이벤트", channel: "instagram", channelLabel: "Instagram", leadIds: ["L10", "L15", "L16", "L17", "L24", "L25"] },
  { code: "C3", title: "US-200 교체 프로그램", channel: "email", channelLabel: "수신 동의 이메일", leadIds: ["L03", "L05", "L08", "L13"] },
  { code: "C4", title: "연구용 초음파 가이드", channel: "blog", channelLabel: "블로그", leadIds: ["L04", "L26", "L27"] },
];

const directLeadIds = ["L07", "L11", "L14", "L18", "L19", "L20", "L21", "L22", "L23", "L28", "L29", "L30"];
const demoLeadAcquisition = new Map<string, { code: AcquisitionCode; label: string }>();
for (const campaign of demoCampaigns) {
  for (const id of campaign.leadIds) demoLeadAcquisition.set(id, { code: campaign.code, label: campaign.code + " " + campaign.channelLabel });
}
for (const id of directLeadIds) demoLeadAcquisition.set(id, { code: "direct", label: "직접 유입" });

export function demoAcquisitionForLead(id: string) {
  return demoLeadAcquisition.get(id);
}

const effectPolicy = { minimumLeads: 3, highThreshold: 0.5, moderateThreshold: 0.2 } as const;

export function campaignEffect(total: number, valid: number, pending = 0): CampaignEffect {
  if (pending > 0) return "판정 전";
  if (total < effectPolicy.minimumLeads) return "판단 보류";
  const ratio = valid / total;
  if (ratio >= effectPolicy.highThreshold) return "효과 높음";
  if (ratio >= effectPolicy.moderateThreshold) return "보통";
  return "효과 낮음";
}

const evaluationAcquisition: readonly AcquisitionCode[] = ["direct", "C1", "C2", "C3", "C4"];

export function evaluationCampaignForLead(id: string): AcquisitionCode | null {
  if (!/^E(?:0[1-9]|[1-6][0-9]|70)$/u.test(id)) return null;
  return evaluationAcquisition[Number(id.slice(1)) % evaluationAcquisition.length];
}
