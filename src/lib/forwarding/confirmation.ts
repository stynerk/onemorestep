import { freeEmailDomains, reservedDomains } from "./institution-policy";
import type { Assessment, AutomaticConfirmation, MailKind } from "./types";

export function automaticConfirmationFor({ verdict, details }: Pick<Assessment, "verdict" | "details">): AutomaticConfirmation | null {
  if (verdict !== "ambiguous" || !details || details.externalStatus === "failed") return null;
  if (details.domain === "free-email") return "free-email";
  // The classifier may guard against a model-only upgrade to valid. A known purchase still belongs in human review.
  if (details.domain === "matched" && details.memoIntent !== "buying" && details.routerMemoIntent !== "buying") return "weak-intent";
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
