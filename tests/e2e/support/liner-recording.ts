import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { institutionProfiles, locales } from "../../../src/lib/forwarding/institution-policy";
import demoLeads from "../../../src/lib/forwarding/seed-leads.json";

export const linerEndpoint = "https://platform.liner.com/api/v1/tools/search/web";
const apiVersion = "v1";
const projectionVersion = "official-institution-facts-v2";
const recordRoot = resolve("tests/fixtures/recorded");
const defaultTruth = resolve("src/lib/forwarding/evaluation/ground-truth.json");
const countryTerms = Object.values(locales).map(([term]) => term);
const industryTerms = ["hospital", "clinic", "university", "research institute"] as const;
const locationCue = /\b(?:address|contact|directions|access|location|located|based|headquarters|head office|campus|street)\b|소재|주소|찾아오시는|오시는 길|所在地|住所|アクセス/iu;
const unrelatedCue = /\b(?:insurance|insurer|partners?|collaboration|patients from|study abroad|delegation|news coverage)\b|보험|협력 기관|해외 환자|保険|共同研究/iu;
const industryQueries = ["hospital clinic dental research institute medical devices", "병원 치과 연구소 의료기기", "病院 歯科 研究所 医療機器"];
const allowedSuffixes = new Set([...countryTerms, ...industryQueries, ...demoLeads.map(({ country }) => country)]);
const institutions = [...new Set(demoLeads.map(({ institution }) => institution).filter(Boolean))]
  .sort((left, right) => right.length - left.length);

type Fact = { domain: string; countries: string[]; industry: (typeof industryTerms)[number] | null };
type Recording = { fingerprint: string; apiVersion: string; projectionVersion: string; recordedAt: string; facts: Fact[] };
type Counters = { live: number; replayed: number; blocked: number; recorded: number };

const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function isWithin(root: string, path: string) {
  const fromRoot = relative(root, path);
  return fromRoot !== ".." && !fromRoot.startsWith(".." + sep) && !isAbsolute(fromRoot);
}

function underRecordingRoot(input: string) {
  const path = resolve(input);
  const actualRoot = realpathSync(recordRoot);
  if (!isWithin(recordRoot, path) || !isWithin(realpathSync("."), actualRoot)) {
    throw new Error("E2E recording and truth-copy paths must be under tests/fixtures/recorded.");
  }
  let existing = path;
  while (!existsSync(existing)) existing = dirname(existing);
  const actual = resolve(realpathSync(existing), relative(existing, path));
  if (!isWithin(actualRoot, actual)) {
    throw new Error("E2E recording path resolves outside tests/fixtures/recorded.");
  }
  return actual;
}

function demoFingerprint() {
  const truth = process.env.MIRINAE_E2E_TRUTH_PATH ? underRecordingRoot(process.env.MIRINAE_E2E_TRUTH_PATH) : defaultTruth;
  const hash = createHash("sha256");
  for (const path of [resolve("src/lib/forwarding/seed-leads.json"), resolve("tests/fixtures/forwarding-source.md"), truth]) {
    const hashOfFile = createHash("sha256").update(readFileSync(path)).digest("hex");
    hash.update(hashOfFile);
  }
  return hash.digest("hex");
}

function institutionForRequest(body: string) {
  const data: unknown = JSON.parse(body);
  if (!object(data) || Object.keys(data).length !== 5 || typeof data.query !== "string"
    || typeof data.lang !== "string" || !/^(?:en|ko|ja|es|pt|fr|zh)$/.test(data.lang)
    || typeof data.country_code !== "string" || !/^[a-z]{2}$/.test(data.country_code)
    || data.max_results !== 3 || data.include_knowledge !== false) return undefined;
  const query = data.query;
  return institutions.find((institution) =>
    query.startsWith(institution + " ") && allowedSuffixes.has(query.slice(institution.length + 1)));
}

function projectFacts(input: unknown, institution: string, domains: string[]): Fact[] {
  if (!object(input) || !Array.isArray(input.results)) throw new Error("Liner E2E response format was invalid.");
  const names = [institution, ...(institutionProfiles[institution]?.names ?? [])];
  return input.results.slice(0, 3).flatMap((source: unknown): Fact[] => {
    if (!object(source) || typeof source.url !== "string" || typeof source.title !== "string"
      || typeof source.description !== "string") return [];
    let url: URL;
    try { url = new URL(source.url); } catch { return []; }
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return [];
    const domain = domains.find((name) => url.hostname === name || url.hostname.endsWith("." + name));
    if (!domain) return [];

    // Keep only allowlisted institutional facts. Raw paths, titles and snippets can contain contact or personal names.
    const { title, description } = source;
    const sentences = [title, ...description.split(/(?<=[.!?])\s+|[。\n]/u)];
    const addressSentences = sentences.flatMap((sentence) => {
      if (unrelatedCue.test(sentence) || !(locationCue.test(title) || locationCue.test(sentence))) return [];
      const text = names.reduce((current, name) =>
        current.replace(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "giu"), " "), sentence);
      return [text];
    });
    const countries = Object.values(locales).flatMap(([term, , , pattern]) =>
      addressSentences.some((sentence) => pattern.test(sentence)) ? [term] : []);
    const text = (title + " " + description).toLowerCase();
    const industry = industryTerms.find((term) => text.includes(term)) ?? null;
    return [{ domain, countries, industry }];
  });
}

function readRecording(path: string, fingerprint: string, domains: string[]) {
  let data: unknown;
  try { data = JSON.parse(readFileSync(path, "utf8")); } catch { return undefined; }
  if (!object(data) || data.fingerprint !== fingerprint || data.apiVersion !== apiVersion
    || data.projectionVersion !== projectionVersion || typeof data.recordedAt !== "string"
    || !Number.isFinite(Date.parse(data.recordedAt)) || !Array.isArray(data.facts) || data.facts.length > 3) return undefined;
  const facts = data.facts;
  if (!facts.every((fact: unknown) => object(fact) && Object.keys(fact).length === 3
    && typeof fact.domain === "string" && domains.includes(fact.domain)
    && (fact.industry === null || industryTerms.some((term) => term === fact.industry))
    && Array.isArray(fact.countries) && fact.countries.every((country: unknown) =>
      typeof country === "string" && countryTerms.includes(country)))) return undefined;
  return facts as Fact[];
}

function replay(institution: string, facts: Fact[]) {
  return Response.json({ results: facts.map(({ domain, countries, industry }) => ({
    title: institution,
    url: "https://" + domain + "/",
    description: [industry, countries.length ? "address in " + countries.join(", ") : null].filter(Boolean).join(" "),
  })) });
}

export function createLinerRecorder(upstream: typeof fetch, getKey: () => string | undefined) {
  const directory = underRecordingRoot(process.env.MIRINAE_E2E_RECORD_DIR ?? recordRoot);
  const inputHash = demoFingerprint();
  const counters: Counters = { live: 0, replayed: 0, blocked: 0, recorded: 0 };
  return {
    counters,
    async fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      const request = new Request(input, init);
      if (request.url !== linerEndpoint || request.method !== "POST") {
        counters.blocked += 1;
        throw new Error("E2E only permits the Liner web search POST.");
      }
      const body = await request.text();
      const institution = institutionForRequest(body);
      if (!institution) {
        counters.blocked += 1;
        throw new Error("E2E only permits queries from the synthetic demonstration inputs.");
      }
      const domains = institutionProfiles[institution]?.domains ?? [];
      const fingerprint = createHash("sha256")
        .update(JSON.stringify([inputHash, apiVersion, projectionVersion, request.url, request.method, body]))
        .digest("hex");
      const path = underRecordingRoot(resolve(directory, fingerprint + ".json"));
      const recorded = readRecording(path, fingerprint, domains);
      if (recorded) {
        counters.replayed += 1;
        return replay(institution, recorded);
      }

      const key = getKey();
      if (!key) {
        counters.blocked += 1;
        throw new Error("A Liner key is required only to capture a new E2E recording.");
      }
      counters.live += 1;
      const response = await upstream(linerEndpoint, {
        method: "POST", body,
        headers: { "Content-Type": "application/json", "x-api-key": key },
        signal: request.signal, redirect: "error", cache: "no-store",
      });
      if (!response.ok) {
        const retryAfter = response.headers.get("Retry-After");
        return new Response(null, {
          status: response.status,
          headers: retryAfter && /^\d{1,4}$/.test(retryAfter) ? { "Retry-After": retryAfter } : undefined,
        });
      }
      const facts = projectFacts(await response.json(), institution, domains);
      const record: Recording = { fingerprint, apiVersion, projectionVersion, recordedAt: new Date().toISOString(), facts };
      mkdirSync(directory, { recursive: true });
      const temp = path + "." + randomUUID() + ".tmp";
      try {
        writeFileSync(temp, JSON.stringify(record, null, 2) + "\n", { flag: "wx" });
        renameSync(temp, path);
      } finally {
        try { unlinkSync(temp); } catch { /* Renamed or never created. */ }
      }
      counters.recorded += 1;
      return replay(institution, facts);
    },
  };
}
