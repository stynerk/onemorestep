export type Source = { title: string; url: string; description: string };
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

function parseSources(body: unknown): Source[] {
  if (!body || typeof body !== "object" || !("results" in body) || !Array.isArray(body.results)) {
    throw new Error("Invalid response");
  }
  return body.results.slice(0, 3).map((item: unknown) => {
    if (!item || typeof item !== "object" || !("title" in item) || !("url" in item) ||
      !("description" in item) || typeof item.title !== "string" ||
      typeof item.url !== "string" || typeof item.description !== "string") {
      throw new Error("Invalid source");
    }
    const url = new URL(item.url);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) {
      throw new Error("Unsafe source URL");
    }
    return { title: item.title, url: url.href, description: item.description };
  });
}

export async function research(query: string, options: Options = {}): Promise<ResearchResult> {
  if (!validQuery(query)) throw new Error("Query must be 2–300 characters");
  query = query.trim();
  if (options.mode !== "live") return sample(query, "예시 모드입니다.");
  if (!options.apiKey?.trim()) return sample(query, "API 키가 설정되지 않았습니다.");

  try {
    const response = await (options.fetcher ?? fetch)(
      "https://platform.liner.com/api/v1/tools/search/web",
      {
        method: "POST",
        headers: { "x-api-key": options.apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ query, lang: "ko", country_code: "kr", max_results: 3, include_knowledge: false }),
        signal: AbortSignal.timeout(options.timeoutMs ?? 8000),
        cache: "no-store",
      },
    );
    if (!response.ok) return sample(query, "실시간 조사를 완료하지 못했습니다.");
    return {
      mode: "live",
      query,
      notice: "Liner 실시간 검색 결과입니다.",
      sources: parseSources(await response.json()),
    };
  } catch {
    // Do not expose provider bodies, errors, headers, or credentials to the browser.
    return sample(query, "실시간 조사 연결이 지연되거나 응답을 확인하지 못했습니다.");
  }
}
