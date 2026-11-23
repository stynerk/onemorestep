import type { ChannelId } from "./policy";

export type MarketingDraft = {
  mode: "live" | "recorded" | "template";
  title: string;
  titleNeedsVerification?: boolean;
  lines: { text: string; needsVerification: boolean; sourceUrl?: string }[];
  sources: { title: string; url: string; excerpt?: string }[];
  warnings: string[];
};

const template: Record<ChannelId, { title: string; lines: string[] }> = {
  email: {
    title: "[이메일 제목]",
    lines: ["대상: 마케팅 수신 동의자", "[인사]", "[요청 배경]", "[안내할 자료]", "[공개 근거]", "[맺음말]", "행동 유도: [자료 요청 안내]"],
  },
  linkedin: { title: "LinkedIn 기본 틀", lines: ["[전문가 대상 소개]", "[공개 근거]", "[해시태그 최대 3개]"] },
  facebook: { title: "Facebook 기본 틀", lines: ["[소개 문장]", "[세부 안내 문장]", "[마무리 문장]", "[링크 자리]"] },
  instagram: { title: "Instagram 기본 틀", lines: ["[캡션]", "이미지 문구 제안: [한 줄]", "[해시태그 최대 5개]"] },
  blog: { title: "[블로그 제목]", lines: ["소제목 1: [요청 배경]", "소제목 2: [검토할 항목]", "소제목 3: [공개 근거]", "[도입 단락]"] },
};

export function marketingDraftTemplate(channel: ChannelId): MarketingDraft {
  const { title, lines } = template[channel];
  return { mode: "template", title, lines: lines.map((text) => ({ text, needsVerification: false })), sources: [], warnings: [] };
}

const safetyAssertion = /(?:효능|효과|효율|성능|안전(?:성|하|합|을)|부작용|위험).{0,26}(?:보장|입증|확실|무조건|전혀\s*없|제로|없습니다)|(?:보장|입증|확실|완벽|완전히|절대|무조건).{0,18}(?:효능|효과|성능|안전|부작용|위험)|(?:항상|누구나|모든).{0,12}(?:안전|효과)|부작용.{0,8}없|완치|안전(?:합니다|하다|해요|한\s*(?:제품|기기))|(?:효능|효과)(?:가|는)?\s*(?:있습니다|있다|있어요|뛰어납니다)|효과적(?:입니다|이다)|(?:guaranteed|completely|always|proven).{0,18}(?:safe|effective)|no\s+side\s+effects|\b(?:is\s+(?:safe|effective)|safe\s+and\s+effective|effective\s+and\s+safe)\b/iu;
const quantifiedClaim = /(?:[0-9]+(?:[.,][0-9]+)?)\s*(?:%|％|퍼센트|배(?!경)|명(?!칭)|건|초|분|시간|일|주|개월|년|회|대(?!상)|mg|mm|cm|kPa|patients?\b|times?\b)/iu;
const superiorityClaim = /최고|최상|세계\s*최초|압도적|더\s*우수|비교\s*우위|타사.{0,18}(?:우수|낫|높|낮)|경쟁.{0,18}(?:앞서|우수|뛰어나)|[0-9]+\s*위(?!해)|\b(?:best|superior|leading|number one|outperform)\b/iu;

export function marketingReviewWarnings(title: string, lines: ReadonlyArray<{ text: string; sourceUrl?: string }>): string[] {
  const warnings = new Set<string>();
  for (const { text, sourceUrl } of [{ text: title, sourceUrl: undefined }, ...lines]) {
    if (safetyAssertion.test(text)) warnings.add("효능·안전 단정 표현 — 실무자 확인 필요");
    if (!sourceUrl && quantifiedClaim.test(text)) warnings.add("근거 없는 수치 — 실무자 확인 필요");
    if (superiorityClaim.test(text)) warnings.add("비교 우위 단정 표현 — 실무자 확인 필요");
  }
  return [...warnings];
}