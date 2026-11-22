import { searchLiner } from "../liner-search";
import type { LinerSearchResult, Source } from "../liner-search";
import { locales } from "./institution-policy";
import { savedInstitutionSources, savedNonMatchSearchedAt, savedSourcesReviewedAt } from "./saved-institution-sources";
import type { InquiryIntent, LeadInput } from "./types";
import { classifyLead } from "./verdict";

const cacheVersion = "institution-extraction-v1";
const freshnessMs = 24 * 60 * 60 * 1000;
const maximumCacheEntries = 200;
const maximumRetryDelayMs = 8000;

type SearchSuccess = { ok: true; sources: Source[]; searchedAt: string; fromCache: boolean };
type QueryResult = SearchSuccess | Extract<LinerSearchResult, { ok: false }>;
type AssessmentConfig = {
  mode?: string;
  apiKey?: string;
  regionalCountry?: string;
  intent?: InquiryIntent | null | Promise<InquiryIntent | null>;
};
type Options = {
  fetcher?: typeof fetch;
  now?: () => number;
  delay?: (milliseconds: number) => Promise<void>;
  timeoutMs?: number;
};

function delayFromHeader(raw: string | undefined, now: number) {
  if (!raw) return 1000;
  if (/^\d+$/.test(raw)) return Number(raw) * 1000;
  const date = Date.parse(raw);
  return Number.isFinite(date) ? Math.max(0, date - now) : 1000;
}

function queriesFor(lead: LeadInput) {
  const [term, language, countryCode] = locales[lead.country] ?? [lead.country, "en", "us"];
  const industryTerm = language === "ko" ? "병원 치과 연구소 의료기기" : language === "ja"
    ? "病院 歯科 研究所 医療機器" : "hospital clinic dental research institute medical devices";
  return { language, countryCode, queries: [lead.institution + " " + term, lead.institution + " " + industryTerm] };
}

export function createAssessmentService(options: Options = {}) {
  const now = options.now ?? Date.now;
  const delay = options.delay ?? ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const cached = new Map<string, { result: SearchSuccess; expiresAt: number }>();
  const pending = new Map<string, Promise<QueryResult>>();
  const queue: (() => void)[] = [];
  let active = 0;
  let limitedUntil = 0;

  async function runRequest(search: () => Promise<LinerSearchResult>) {
    if (active === 2) await new Promise<void>((resolve) => queue.push(resolve));
    else active += 1;
    try {
      if (now() < limitedUntil) return { ok: false, reason: "rate-limited" } as const;
      const result = await search();
      if (!result.ok && result.reason === "rate-limited") {
        limitedUntil = Math.max(limitedUntil, now() + delayFromHeader(result.retryAfter, now()));
      }
      return result;
    } finally {
      const next = queue.shift();
      if (next) next();
      else active -= 1;
    }
  }

  async function queryFor(lead: LeadInput, query: string, language: string, countryCode: string, apiKey: string): Promise<QueryResult> {
    const cacheKey = JSON.stringify([cacheVersion, lead.institution.normalize("NFKC").trim().toLowerCase(), lead.country,
      query.normalize("NFKC").trim().toLowerCase(), language, countryCode, false]);
    const previous = cached.get(cacheKey);
    if (previous && previous.expiresAt > now()) return { ...previous.result, fromCache: true };
    const existing = pending.get(cacheKey);
    if (existing) {
      const result = await existing;
      return result.ok ? { ...result, fromCache: true } : result;
    }

    const search = () => searchLiner(query, { apiKey, language, countryCode, fetcher: options.fetcher, timeoutMs: options.timeoutMs });
    const operation = (async (): Promise<QueryResult> => {
      let result = await runRequest(search);
      if (!result.ok && result.reason === "rate-limited") {
        const remaining = limitedUntil - now();
        if (remaining <= maximumRetryDelayMs) {
          if (remaining > 0) await delay(remaining);
          result = await runRequest(search);
        }
      }
      if (!result.ok) return result;
      const success: SearchSuccess = { ...result, searchedAt: new Date(now()).toISOString(), fromCache: false };
      cached.delete(cacheKey);
      cached.set(cacheKey, { result: success, expiresAt: now() + freshnessMs });
      if (cached.size > maximumCacheEntries) {
        const oldest = cached.keys().next().value;
        if (oldest) cached.delete(oldest);
      }
      return success;
    })();
    pending.set(cacheKey, operation);
    try {
      return await operation;
    } finally {
      pending.delete(cacheKey);
    }
  }

  return {
    async assess(lead: LeadInput, config: AssessmentConfig) {
      const nowIso = () => new Date(now()).toISOString();
      if (!lead.institution.trim()) {
        return classifyLead(lead, { sources: [], searchedAt: nowIso(), kind: "local", status: "not-needed" }, config.regionalCountry, await config.intent);
      }
      const apiKey = config.apiKey?.trim();
      if (config.mode?.trim() !== "live" || !apiKey) {
        const sources = savedInstitutionSources(lead.institution);
        const savedAt = sources.length ? savedSourcesReviewedAt : savedNonMatchSearchedAt(lead.institution, lead.country);
        return classifyLead(lead, {
          sources, searchedAt: savedAt ?? nowIso(), kind: "curated",
          status: savedAt ? "complete" : "saved-unavailable",
        }, config.regionalCountry, await config.intent);
      }

      const { queries, language, countryCode } = queriesFor(lead);
      const results = await Promise.all(queries.map((query) => queryFor(lead, query, language, countryCode, apiKey)));
      const successes = results.filter((result): result is SearchSuccess => result.ok);
      const complete = successes.length === results.length;
      const storedCount = successes.filter((result) => result.fromCache).length;
      const kind = storedCount === results.length ? "cache" : storedCount > 0 ? "mixed" : "liner";
      return classifyLead(lead, {
        sources: successes.flatMap((result) => result.sources),
        searchedAt: successes.map((result) => result.searchedAt).sort().at(-1) ?? nowIso(),
        kind,
        status: complete ? "complete" : "failed",
      }, config.regionalCountry, await config.intent);
    },
  };
}
