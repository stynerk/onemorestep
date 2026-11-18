import type { LeadInput, MailKind, RecipientKind } from "./types";

const recipientLabels: Record<RecipientKind, string> = {
  dealer: "딜러",
  lead: "리드",
  manager: "지역 담당자",
  operations: "운영",
};

const templates: Record<MailKind, { to: RecipientKind; title: string; instruction: string }> = {
  "dealer-summary": { to: "dealer", title: "딜러용 리드 요약", instruction: "승인된 문의의 관심 상품과 요청을 확인해 주세요." },
  "country-check": { to: "lead", title: "국가 확인 요청", instruction: "문의 기관의 소재지와 견적이 필요한 국가를 알려 주세요." },
  "partnership-check": { to: "lead", title: "제휴 상세 요청", instruction: "제휴 목적, 진행 일정, 기대하는 협업 범위를 알려 주세요." },
  "manager-confirmation": { to: "manager", title: "지역 담당자 확인 요청", instruction: "문의 국가의 딜러 배정 가능 여부를 확인해 주세요." },
  operations: { to: "operations", title: "운영 알림", instruction: "리드 국가와 담당 지역의 연결을 확인해 주세요." },
};

export function isMailKind(value: unknown): value is MailKind {
  return typeof value === "string" && Object.hasOwn(templates, value);
}

export function renderForwardingMail(kind: MailKind, lead: Pick<LeadInput, "id" | "institution" | "country" | "memo"> & { product: string }) {
  const { to: recipientKind, title, instruction } = templates[kind];
  const lines = [
    "가상 리드, 실제 딜러에게 보내지 않음",
    `원래 수신자: ${recipientLabels[recipientKind]}`,
    "",
    instruction,
    "",
    `기관: ${lead.institution || "소속 없음"}`,
    `문의 국가: ${lead.country}`,
    `관심 상품: ${lead.product}`,
  ];
  if (kind === "dealer-summary") lines.push(`문의 요약: ${lead.memo}`);
  return { recipientKind, subject: `[TEST] ${lead.id} ${title}`, text: lines.join("\n") };
}
