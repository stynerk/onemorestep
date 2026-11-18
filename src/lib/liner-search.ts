export type Source = { title: string; url: string; description: string };
export type LinerSearchResult =
  | { ok: true; sources: Source[] }
  | { ok: false; reason: "timeout" | "rate-limited" | "unavailable"; retryAfter?: string };

type SearchOptions = {
  apiKey: string;
  language: string;
  countryCode: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
};

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
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.href.length > 2000) {
      throw new Error("Unsafe source URL");
    }
    return { title: item.title, url: url.href, description: item.description };
  });
}

/** One upstream call. Callers choose their own fallback and retry policies. */
export async function searchLiner(query: string, options: SearchOptions): Promise<LinerSearchResult> {
  const signal = AbortSignal.timeout(options.timeoutMs ?? 8000);
  try {
    const response = await (options.fetcher ?? fetch)("https://platform.liner.com/api/v1/tools/search/web", {
      method: "POST",
      headers: { "x-api-key": options.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        lang: options.language,
        country_code: options.countryCode,
        max_results: 3,
        include_knowledge: false,
      }),
      signal,
      cache: "no-store",
      redirect: "error",
    });
    if (response.status === 429) {
      return { ok: false, reason: "rate-limited", retryAfter: response.headers.get("Retry-After") ?? undefined };
    }
    if (!response.ok) return { ok: false, reason: "unavailable" };
    return { ok: true, sources: parseSources(await response.json()) };
  } catch {
    return { ok: false, reason: signal.aborted ? "timeout" : "unavailable" };
  }
}
