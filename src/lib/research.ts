import { searchLiner } from "./liner-search";
import type { Source } from "./liner-search";

export type { Source } from "./liner-search";
export type ResearchResult = {
  mode: "live" | "sample";
  query: string;
  sampleQuery?: string;
  notice: string;
  sources: Source[];
};

type Options = {
  mode?: string;
  apiKey?: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
};

export function validQuery(value: unknown): value is string {
  return typeof value === "string" && value.trim().length >= 2 && value.trim().length <= 300;
}

function sample(query: string, notice: string): ResearchResult {
  return {
    mode: "sample",
    query,
    sampleQuery: "Liner API로 출처 있는 조사 기능을 준비하려면?",
    notice: `${notice} 아래는 미리 작성한 예시이며, 입력한 질의의 실제 검색 결과가 아닙니다.`,
    sources: [
      {
        title: "Liner Search API 공식 문서",
        url: "https://liner.com/developers/docs/search-api",
        description: "개발 세팅 예시: 웹 검색 결과의 제목, 설명, URL을 조사 화면에 표시합니다.",
      },
      {
        title: "Liner 호출 한도 공식 문서",
        url: "https://liner.com/developers/docs/rate-limits",
        description: "개발 세팅 예시: 호출 실패에 대비해 예시 응답을 준비합니다.",
      },
    ],
  };
}

export async function research(query: string, options: Options = {}): Promise<ResearchResult> {
  if (!validQuery(query)) throw new Error("Query must be 2–300 characters");
  query = query.trim();
  if (options.mode !== "live") return sample(query, "예시 모드입니다.");
  if (!options.apiKey?.trim()) return sample(query, "API 키가 설정되지 않았습니다.");

  const result = await searchLiner(query, {
    apiKey: options.apiKey,
    language: "ko",
    countryCode: "kr",
    fetcher: options.fetcher,
    timeoutMs: options.timeoutMs,
  });
  if (!result.ok) {
    const notice = result.reason === "timeout"
      ? "실시간 조사 연결이 지연되거나 응답을 확인하지 못했습니다."
      : "실시간 조사를 완료하지 못했습니다.";
    return sample(query, notice);
  }
  return { mode: "live", query, notice: "Liner 실시간 검색 결과입니다.", sources: result.sources };
}
