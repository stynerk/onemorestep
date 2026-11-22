import { createHash } from "node:crypto";
import {
  applyDirectionWording, directionQuestionPlaceholders, getDirectionQuestion, getRecordedDirectionWording, validateDirectionWording,
  type DirectionKind, type DirectionWording,
} from "./direction-questions";
import type { Assessment, LeadInput } from "./types";

const endpoint = "https://platform.liner.com/api/v1/chat/completions";
const prompt = [
  "Write one concise Korean question and one concise Korean evidence summary for a sales operator reviewing an ambiguous lead.",
  "The question must implement the supplied task, without answering it, listing options, or requesting extra information. End with a single question mark.",
  "Copy each supplied question placeholder exactly once as given. The application substitutes the values later. Do not use any additional placeholders.",
  "Write the summary as one plain Korean sentence including exactly one {{evidence}} placeholder. This placeholder is a complete Korean clause ending in 요 with no period. A short leading connector before it is fine. Do not add other facts or claims.",
  "Do not add any names, URLs, email addresses, markdown, or HTML. Return only JSON with question and summary.",
].join(" ");

const tasks = {
  domain: "Ask whether the inquiry email domain is used by the institution.",
  location: "Ask if the institution is located in the country on the inquiry.",
  spoof: "The email domain differs from the official domain. Ask whether to handle this as a legitimate customer inquiry.",
  intent: "Ask if the inquiry is about purchasing the product.",
  evidence: "Ask whether to verify the inquiry by phone, because the affiliation could not be determined from the available material.",
} satisfies Record<DirectionKind, string>;

export function buildDirectionQuestionRequest(kind: DirectionKind) {
  return {
    model: "liner-gpt-router",
    reasoning_effort: "none",
    max_completion_tokens: 200,
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: JSON.stringify({
        task: tasks[kind], questionPlaceholders: directionQuestionPlaceholders[kind].map((key) => "{{" + key + "}}"), evidencePlaceholder: "{{evidence}}",
      }) },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "direction_question",
        strict: true,
        schema: {
          type: "object",
          properties: { question: { type: "string" }, summary: { type: "string" } },
          required: ["question", "summary"],
          additionalProperties: false,
        },
      },
    },
  };
}

const object = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

export function parseDirectionQuestionResponse(response: unknown, kind: DirectionKind): DirectionWording | null {
  if (!object(response) || !Array.isArray(response.choices) || response.choices.length !== 1) return null;
  const [choice] = response.choices;
  if (!object(choice) || choice.finish_reason !== "stop" || !object(choice.message)
    || choice.message.refusal || typeof choice.message.content !== "string") return null;
  const toolCalls = choice.message.tool_calls;
  if (toolCalls != null && (!Array.isArray(toolCalls) || toolCalls.length !== 0)) return null;
  try {
    return validateDirectionWording(JSON.parse(choice.message.content), kind);
  } catch {
    return null;
  }
}

export function directionQuestionFingerprint(kind: DirectionKind) {
  return createHash("sha256").update(JSON.stringify([endpoint, buildDirectionQuestionRequest(kind)]), "utf8").digest("hex");
}

type RouterOptions = { publicDemo: boolean; mode?: string; apiKey?: string; fetcher?: typeof fetch; timeoutMs?: number };

async function requestQuestion(kind: DirectionKind, options: RouterOptions): Promise<DirectionWording | null> {
  const apiKey = options.apiKey?.trim();
  if (options.mode?.trim() !== "live" || !apiKey) return null;
  try {
    const response = await (options.fetcher ?? fetch)(endpoint, {
      method: "POST",
      headers: { authorization: "Bearer " + apiKey, "content-type": "application/json" },
      body: JSON.stringify(buildDirectionQuestionRequest(kind)),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(options.timeoutMs ?? 1500),
    });
    return response.ok ? parseDirectionQuestionResponse(await response.json(), kind) : null;
  } catch {
    return null;
  }
}

export async function formulateDirectionQuestion(lead: LeadInput, assessment: Assessment, options: RouterOptions): Promise<DirectionWording | null> {
  if (assessment.verdict !== "ambiguous") return null;
  const { kind } = getDirectionQuestion(lead, assessment);
  if (options.publicDemo) return getRecordedDirectionWording(lead, assessment, directionQuestionFingerprint(kind));
  const wording = await requestQuestion(kind, options);
  return wording && applyDirectionWording(wording, lead, assessment, kind);
}
