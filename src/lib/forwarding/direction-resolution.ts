import { rankAvailableDealers } from "./dealers";
import { directionEmailDomain, getDirectionQuestion } from "./direction-questions";
import { handoffForAssessment, regionalSalesHandoff } from "./handoff";
import { regionalHandoffForPolicy } from "./industry-demo";
import { locales } from "./institution-policy";
import type { Assessment, DirectionAnswer, DirectionConfirmation, ForwardingState, LeadInput, Verdict } from "./types";

export const DIRECTION_ACTOR = "시연 담당자";

export function isDirectionAnswerFor(lead: LeadInput, assessment: Assessment, answer: DirectionAnswer & { previous?: boolean }) {
  if (assessment.verdict !== "ambiguous") return false;
  const question = getDirectionQuestion(lead, assessment);
  if (question.kind !== answer.kind || !question.choices.some(({ value }) => value === answer.choice)) return false;
  if (answer.kind !== "location" || answer.choice === "unknown") return answer.country === undefined;
  if (answer.choice === "other-country") {
    return typeof answer.country === "string" && Object.hasOwn(locales, answer.country)
      && (answer.previous === true || answer.country !== lead.country);
  }
  const country = answer.country ?? lead.country;
  return Object.hasOwn(locales, country) && (answer.previous === true || country === lead.country);
}

/** Resume the remaining checks from the frozen assessment and the single human-confirmed fact. */
export function applyDirectionConfirmation(
  lead: LeadInput, assessment: Assessment, confirmation: DirectionConfirmation, state?: ForwardingState,
): Assessment {
  if (!isDirectionAnswerFor(lead, assessment, confirmation) || (confirmation.previous && confirmation.kind !== "domain" && confirmation.kind !== "location")) {
    return assessment;
  }
  const base = { ...assessment };
  delete base.directionQuestion;
  if (confirmation.choice === "unknown") return { ...base, directionConfirmation: confirmation };

  const details = assessment.details;
  if (!details) return assessment;
  if (confirmation.choice === "no") {
    const reason = confirmation.kind === "intent" ? "담당자가 구매 문의가 아님을 확인했어요."
      : confirmation.kind === "spoof" ? "담당자가 사칭 문의로 확인했어요."
        : "담당자가 이메일 도메인이 기관 소속이 아님을 확인했어요.";
    return { ...base, verdict: "invalid", reason, handoff: { kind: "none" }, directionConfirmation: confirmation };
  }

  let updated = details;
  const earlierCountry = assessment.directionConfirmation?.kind === "location" ? assessment.directionConfirmation.country : undefined;
  let country = earlierCountry ?? lead.country;
  let recorded = confirmation;
  if (confirmation.kind === "domain" || confirmation.kind === "spoof") updated = { ...details, domain: "matched" };
  if (confirmation.kind === "location") {
    country = confirmation.country ?? lead.country;
    updated = { ...details, countries: [country] };
    recorded = { ...confirmation, country };
  }
  if (confirmation.kind === "intent") {
    updated = { ...details, memoIntent: "buying", memoQuote: null };
    delete updated.memoSource;
  }

  let verdict: Verdict;
  let reason: string;
  if (updated.countries.length !== 1) {
    const liveEvidence = ["liner", "cache", "mixed"].includes(updated.sourceKind);
    if (liveEvidence && updated.memoIntent === "partnership") {
      verdict = "partnership-check";
      reason = "제휴 제안의 자세한 내용과 기관 소재지를 확인해야 해요.";
    } else {
      verdict = "ambiguous";
      reason = "기관 소재지를 한 나라로 확인하지 못했어요.";
    }
  } else if (updated.countries[0] !== country) {
    verdict = "country-check";
    reason = "기관 소재지가 리드 국가와 달라 회신으로 확인이 필요해요.";
  } else if (updated.memoIntent === "partnership") {
    verdict = "partnership-check";
    reason = "제휴 제안의 자세한 내용을 확인해야 해요.";
  } else if (updated.memoIntent === "buying") {
    verdict = "valid";
    reason = "소속 기관과 이메일 도메인이 확인됐고 제품 구매·검토 의향이 있어요.";
  } else {
    verdict = "ambiguous";
    reason = "문의 의도를 전화로 확인해야 해요.";
  }

  let handoff = handoffForAssessment({ ...lead, country }, verdict, updated.memoIntent, lead.country);
  if (state && verdict === "valid") {
    const recommendation = rankAvailableDealers(state, lead, { country });
    handoff = recommendation.route === "dealer"
      ? { kind: "dealer", dealerId: recommendation.ranked[0].dealer.id }
      : regionalSalesHandoff(country);
  }
  return { ...base, verdict, reason, details: updated,
    handoff: regionalHandoffForPolicy(handoff, verdict === "valid" ? country : lead.country, state?.policy),
    directionConfirmation: recorded };
}

const institutionKey = (lead: LeadInput) => lead.institution.normalize("NFKC").trim().replace(/\s+/gu, " ").toLowerCase();

function recalledConfirmation(state: ForwardingState, lead: LeadInput, kind: DirectionAnswer["kind"], otherLeadOnly: boolean) {
  if (!otherLeadOnly) {
    const current = state.events.findLast((event) => event.type === "assessed" && event.leadId === lead.id
      && event.assessment.directionConfirmation?.kind === kind && !event.assessment.directionConfirmation.previous);
    if (current?.type === "assessed") return current.assessment.directionConfirmation;
  }
  const institution = institutionKey(lead);
  const domain = directionEmailDomain(lead.email);
  for (const event of state.events.toReversed()) {
    if (event.type !== "assessed" || event.leadId === lead.id) continue;
    const answer = event.assessment.directionConfirmation;
    if (!answer || answer.previous || answer.kind !== kind) continue;
    if (answer.choice === "unknown" || (kind !== "domain" && kind !== "location") || !institution) continue;
    const origin = state.leads.find(({ id }) => id === event.leadId);
    if (!origin || institutionKey(origin) !== institution) continue;
    if (kind === "domain" && (!domain || directionEmailDomain(origin.email) !== domain)) continue;
    return { ...answer, previous: true };
  }
}

export function directionConfirmationFor(state: ForwardingState, lead: LeadInput, assessment: Assessment) {
  if (assessment.verdict !== "ambiguous") return undefined;
  const kind = getDirectionQuestion(lead, assessment).kind;
  const confirmation = recalledConfirmation(state, lead, kind, false);
  return confirmation && isDirectionAnswerFor(lead, assessment, confirmation) ? confirmation : undefined;
}

/** A reused fact retains the original author, note and time. */
export function matchesPreviousDirectionConfirmation(state: ForwardingState, lead: LeadInput, confirmation: DirectionConfirmation) {
  const remembered = recalledConfirmation(state, lead, confirmation.kind, true);
  return !!remembered && remembered.at === confirmation.at && remembered.actor === confirmation.actor
    && remembered.choice === confirmation.choice && remembered.note === confirmation.note && remembered.country === confirmation.country;
}
