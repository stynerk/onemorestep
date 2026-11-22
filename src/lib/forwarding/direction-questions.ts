import { reservedDomains } from "./institution-policy";
import recordedQuestions from "./saved-direction-questions.json";
import type { Assessment, LeadInput } from "./types";

export type DirectionKind = "domain" | "location" | "spoof" | "intent" | "evidence";
export type DirectionChoice = "yes" | "no" | "unknown" | "other-country";
export type DirectionWording = { question: string; summary: string };
export type DirectionQuestion = DirectionWording & {
  kind: DirectionKind;
  missing: string;
  choices: readonly { value: DirectionChoice; label: string }[];
};

export const directionQuestionPlaceholders: Readonly<Record<DirectionKind, readonly string[]>> = {
  domain: ["domain", "institution"], location: ["institution", "country"], spoof: ["domain"], intent: [], evidence: [],
};

type RecordedQuestion = { fingerprint: string; wording: unknown };
const records: Partial<Record<DirectionKind, RecordedQuestion>> = recordedQuestions;

export function directionEmailDomain(email: string) {
  return /^[^\s@]+@((?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,})$/iu.exec(email.trim())?.[1].toLowerCase() ?? "";
}

const unknown = { value: "unknown", label: "모르겠다(전화로 확인)" } as const;
const questions = {
  domain: {
    question: "{{domain}} 메일을 {{institution}}에서 사용하는 주소로 볼까요?",
    missing: "이메일 도메인과 기관의 관계를 확인하지 못했어요.",
    choices: [{ value: "yes", label: "맞다" }, { value: "no", label: "아니다" }, unknown],
  },
  location: {
    question: "{{institution}}의 소재지가 문의에 적힌 {{country}}인가요?",
    missing: "기관 소재지를 한 나라로 확인하지 못했어요.",
    choices: [{ value: "yes", label: "맞다" }, { value: "other-country", label: "다른 나라" }, unknown],
  },
  spoof: {
    question: "공식 도메인과 다른 {{domain}} 메일을 정상 고객 문의로 진행할까요?",
    missing: "이 주소를 사용하는 문의자가 실제 기관 소속인지 확인하지 못했어요.",
    choices: [{ value: "yes", label: "정상 고객으로 진행" }, { value: "no", label: "사칭으로 무효" }, unknown],
  },
  intent: {
    question: "이 문의를 구매 문의로 볼까요?",
    missing: "제품 구매 의도를 확인하지 못했어요.",
    choices: [{ value: "yes", label: "구매" }, { value: "no", label: "구매 아님" }, unknown],
  },
  evidence: {
    question: "공개 근거로 확인하기 어려운 문의를 전화로 확인할까요?",
    missing: "기관 소속을 확인할 근거가 충분하지 않아요.",
    choices: [unknown],
  },
} satisfies Record<DirectionKind, Omit<DirectionQuestion, "kind" | "summary">>;

export function directionChoiceLabel(kind: DirectionKind, choice: DirectionChoice) {
  return questions[kind].choices.find(({ value }) => value === choice)?.label ?? "";
}

function confirmationKind(assessment: Assessment, domain: string): DirectionKind {
  const details = assessment.details;
  if (!details || details.externalStatus !== "complete") return "evidence";
  if (details.domain === "suspicious") return "spoof";
  if (details.domain === "matched") return details.countries.length === 1 ? "intent" : "location";
  if (!domain || details.domain === "free-email" || reservedDomains.some((reserved) => domain === reserved || domain.endsWith("." + reserved))) {
    return "evidence";
  }
  return assessment.sources.length ? "domain" : "evidence";
}

function directionVerifiedSummary(assessment: Assessment, kind: DirectionKind) {
  if (kind === "spoof") return "공식 도메인과 문의 이메일 도메인이 달라요";
  if (kind === "location") return "기관과 이메일 도메인의 관계를 확인했어요";
  if (kind === "intent") return "기관의 이메일 도메인과 소재지를 확인했어요";
  if (assessment.details?.domain === "free-email") return "무료 이메일 주소로 문의가 접수됐어요";
  if (assessment.details?.externalStatus === "failed") return "외부 자료를 확인하는 중 오류가 발생했어요";
  if (assessment.sources.length) return "아래 공개 출처를 검토했어요";
  return "문의에 적힌 기관명과 이메일 도메인을 검토했어요";
}

function renderDirectionWording(template: DirectionWording, lead: LeadInput, evidence: string): DirectionWording {
  const fields: Record<string, string> = {
    institution: lead.institution.trim() || "문의에 적힌 기관",
    domain: directionEmailDomain(lead.email) || "문의에 적힌 이메일 도메인",
    country: lead.country,
    evidence,
  };
  const render = (text: string) => text.replace(/\{\{([a-z]+)\}\}/gu, (_, field: string) => fields[field] ?? "");
  return { question: render(template.question), summary: render(template.summary) };
}

export function getDirectionQuestion(lead: LeadInput, assessment: Assessment): DirectionQuestion {
  const kind = confirmationKind(assessment, directionEmailDomain(lead.email));
  const { question, missing, choices } = questions[kind];
  const wording = renderDirectionWording({ question, summary: "{{evidence}}." }, lead, directionVerifiedSummary(assessment, kind));
  return { kind, missing, choices, ...wording };
}

export function validateDirectionWording(value: unknown, kind: DirectionKind): DirectionWording | null {
  if (typeof value !== "object" || value === null || Object.keys(value).length !== 2
    || !("question" in value) || !("summary" in value) || typeof value.question !== "string" || typeof value.summary !== "string") return null;
  const question = value.question.trim();
  const summary = value.summary.trim();
  const placeholders = [...question.matchAll(/\{\{([a-z]+)\}\}/gu)].map(([, key]) => key).sort();
  const text = question.replace(/\{\{[a-z]+\}\}/gu, "");
  if (question.length > 180 || !/^[^?]+\?$/u.test(question) || !/[가-힣]/u.test(text) || /[\p{C}{}<>@`\[\]]/u.test(text)
    || /https?:|\b(?:[a-z\d-]+\.)+[a-z]{2,}\b/iu.test(text)
    || placeholders.join(",") !== [...directionQuestionPlaceholders[kind]].sort().join(",")) return null;
  if (!/^(?:(?:현재까지|지금까지) )?\{\{evidence\}\}\.?$/u.test(summary)) return null;
  return { question, summary };
}

export function applyDirectionWording(wording: DirectionWording, lead: LeadInput, assessment: Assessment, kind: DirectionKind) {
  const summary = wording.summary.endsWith(".") ? wording.summary : wording.summary + ".";
  return renderDirectionWording({ ...wording, summary }, lead, directionVerifiedSummary(assessment, kind));
}

export function getRecordedDirectionWording(lead: LeadInput, assessment: Assessment, expectedFingerprint?: string): DirectionWording | null {
  if (assessment.verdict !== "ambiguous") return null;
  const kind = confirmationKind(assessment, directionEmailDomain(lead.email));
  const record = records[kind];
  if (!record || (expectedFingerprint && record.fingerprint !== expectedFingerprint)) return null;
  const wording = validateDirectionWording(record.wording, kind);
  return wording && applyDirectionWording(wording, lead, assessment, kind);
}
