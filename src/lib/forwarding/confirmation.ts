import { freeEmailDomains, reservedDomains } from "./institution-policy";
import type { Assessment, AutomaticConfirmation, LeadInput, MailKind } from "./types";

type ConfirmationEvidence = Pick<Assessment, "verdict" | "reason" | "details">;

const weakIntentPhrases = [
  /^(?:자료만|참고용)(?:\s*(?:보내\s*주세요|받아\s*볼게요|부탁드립니다|입니다))?$/u,
  /^(?:for reference(?: only)?|just for reference|price(?: please)?)$/iu,
  /^(?:資料だけ(?:ください|お願いします)?|参考まで(?:に)?)$/u,
  /^(?:nur zur information|nur zur orientierung|preis)$/iu,
  /^(?:pour information(?: seulement)?|à titre informatif|prix)$/iu,
  /^(?:solo para referencia|solo información|precio)$/iu,
];

function hasWeakIntent(memo: string) {
  const phrase = memo.normalize("NFKC").trim().replace(/\s+/gu, " ").replace(/[.!?。！？]+$/u, "").trimEnd();
  // Require a whole, low-information request. An unrecognized purchase or partnership keeps its human review.
  return weakIntentPhrases.some((pattern) => pattern.test(phrase));
}

export function automaticConfirmationFor(
  { verdict, reason, details }: ConfirmationEvidence, lead: Pick<LeadInput, "memo">,
): AutomaticConfirmation | null {
  if (verdict !== "ambiguous" || details?.externalStatus !== "complete") return null;
  // Both outcomes occur only after the frozen engine confirms an official page.
  if (details.domain === "free-email" && reason === "무료 이메일로는 기관 소속을 확인하기 어려워요.") return "free-email";
  if (details.domain === "matched" && details.memoIntent === "unknown"
    && reason === "문의 의도를 전화로 확인해야 해요." && hasWeakIntent(lead.memo)) return "weak-intent";
  return null;
}

export function isAutomaticConfirmation(value: unknown): value is AutomaticConfirmation {
  return value === "free-email" || value === "weak-intent";
}

export function isConfirmationMail(value: MailKind) {
  return value === "free-email-confirmation" || value === "weak-intent-confirmation";
}

export function confirmationReply(value: unknown): { kind: AutomaticConfirmation; text: string } | null {
  if (typeof value !== "object" || value === null || !("kind" in value) || !("text" in value)
    || Object.keys(value).length !== 2 || !isAutomaticConfirmation(value.kind) || typeof value.text !== "string") return null;
  const { kind } = value;
  const text = value.text.trim();
  if (!text || text.length > 500) return null;
  if (kind === "free-email") {
    const domain = /^[a-z0-9_+.%'-]+@((?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63})$/i.exec(text)?.[1]?.toLowerCase();
    if (!domain || text.length > 254 || [...freeEmailDomains, ...reservedDomains].some((root) => domain === root || domain.endsWith("." + root))) return null;
  }
  return { kind, text };
}
