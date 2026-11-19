import type { Source } from "../liner-search";
import { freeEmailDomains, institutionProfiles, locales, thirdPartyDomains } from "./institution-policy";
import { forwardingPolicy } from "./policy";
import type { Assessment, AssessmentDetails, LeadInput, MemoIntent, Verdict, WorkflowState } from "./types";

type SearchEvidence = {
  sources: Source[];
  searchedAt: string;
  kind: AssessmentDetails["sourceKind"];
  status: AssessmentDetails["externalStatus"];
};

const intentRules: [MemoIntent, RegExp][] = [
  ["job", /구직|채용|입사|履歴書|採用|応募|\b(?:job application|applying for|job opening|career opportunity|sales position)\b/iu],
  ["student", /과제|졸업\s*논문|수업|課題|卒業論文|\b(?:class project|student assignment|homework|thesis)\b/iu],
  ["sales", /판매\s*(?:제안|드립니다)|영업\s*제안|サービスのご提案|弊社製品|\b(?:we (?:sell|offer|provide)|(?:like|want) to offer|our sales services|corporate banking services)\b/iu],
  ["partnership", /제휴|협업|공동\s*마케팅|提携|協業|共同開発|\b(?:partnership|collaboration|co[- ]marketing|joint venture)\b/iu],
  ["buying", /구매|검토|견적|도입|교체|카탈로그|시연|見積(?:もり|り)?|検討|購入|導入|\b(?:purchas\w*|quote|quotation|pric\w*|requesting a demo|interested in a demo|tender|budget approved|replacing|evaluat\w*|considering adoption|product comparison|urgent order|large order)\b/iu],
];

const industryRules: [string, RegExp][] = [
  ["치과", /치과|歯科|\bdental\b/iu],
  ["병원·의원", /병원|의원|病院|診療所|\b(?:hospital|clinic)\b/iu],
  ["연구소", /연구소|研究所|\bresearch (?:organization|institute|lab)\b/iu],
  ["대학 연구실", /대학교|大学|\buniversity\b/iu],
  ["제약·바이오", /제약|製薬|\b(?:pharma\w*|biotech\w*)\b/iu],
  ["의료기기 유통", /의료기기\s*유통|\bmedical (?:device|equipment) distribut\w*\b/iu],
  ["자동차", /자동차|自動車|\bautomotive\b/iu],
];

const genericNameTerms = new Set(["the", "and", "university", "hospital", "clinic", "medical", "center", "international", "general", "corporation", "company", "group", "foundation"]);
const institutionalName = (value: string) => value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const compact = (value: string) => institutionalName(value).replace(/ /g, "");
const matchesName = (text: string, name: string) => {
  const normalized = institutionalName(name);
  return normalized.length > 0 && (" " + institutionalName(text) + " ").includes(" " + normalized + " ");
};
const hostOf = (source: Source) => new URL(source.url).hostname;

export function matchesDomain(host: string, domain: string): boolean {
  return host === domain || host.endsWith("." + domain);
}

function namesFor(institution: string) {
  const profile = Object.hasOwn(institutionProfiles, institution) ? institutionProfiles[institution] : undefined;
  return { names: [institution, ...(profile?.names ?? [])], domains: profile?.domains ?? [] };
}

function affiliatedSources(institution: string, sources: Source[]) {
  const { names, domains } = namesFor(institution);
  const matching = sources.filter((source) =>
    names.some((name) => matchesName(source.title, name) || matchesName(source.description, name))
    || domains.some((domain) => matchesDomain(hostOf(source), domain)));
  const official = matching.filter((source) => {
    const host = hostOf(source);
    return !thirdPartyDomains.some((domain) => matchesDomain(host, domain))
      && domains.some((domain) => matchesDomain(host, domain));
  });
  return { matching, official, names, domains };
}

const locationCue = /\b(?:address|contact|directions|access|location|located|based|headquarters|head office|campus|street)\b|소재|주소|찾아오시는|오시는 길|所在地|住所|アクセス/iu;
const unrelatedLocationCue = /\b(?:partners?|collaboration|patients from|study abroad|delegation|news coverage)\b|협력 기관|해외 환자|共同研究/iu;

function findCountries(sources: Source[], names: string[]): string[] {
  const sortedNames = [...names].sort((left, right) => right.length - left.length);
  return Object.entries(locales).flatMap(([country, [, , , pattern]]) =>
    sources.some(({ title, description }) => {
      // An institution name can contain a country or city without proving its address.
      const sentences = [title, ...description.split(/(?<=[.!?])\s+|[。\n]/u)];
      return sentences.some((sentence) => {
        if (unrelatedLocationCue.test(sentence) || !(locationCue.test(title) || locationCue.test(sentence))) return false;
        const content = sortedNames.reduce((text, name) => {
          const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          return escaped ? text.replace(new RegExp(escaped, "giu"), " ") : text;
        }, sentence);
        return pattern.test(content);
      });
    }) ? [country] : []);
}

const physicalLocationCue = /\baddress(?:es)?\s*(?:[:–—-]|(?:is\s+)?(?:in|at|on)\b)|주소|소재지|所在地|住所/iu;
const nonPhysicalContext = /\b(?:insurance|insurer|coverage|medical tourism|travel(?:l?ing)? (?:from|to)|visitors? from|studied in|trained in|students? from|alumni|affiliated with|news|P\.?O\.? Box)\b|보험|의료\s*관광|유학|해외\s*연수|保険|医療ツーリズム|留学|bảo hiểm/iu;
const streetPatterns = [
  /\b\d{1,6}(?:[-/]\d{1,6})?,?\s+(?:[\p{L}\p{N}.'-]+\s+){1,7}(?:street|st|road|rd|avenue|ave|boulevard|blvd|drive|dr|way|lane|ln|place|pl|court|ct|square|sq|parkway|pkwy|highway|hwy)\b/iu,
  /\b[\p{L}.-]*(?:straße|strasse|platz|allee|weg)\s+\d{1,6}\b/iu,
  /^\s*(?:no\s+)?\d{1,6}(?:[-/]\d{1,6})*\s+\p{L}[^,;.]{2,65}(?=,\s*[^,;.]+,\s*[^,;.]+)/iu,
];
const eastAsianStreet = /[가-힣][가-힣\d]*(?:대로|로|길)\s*\d+|〒\s*\d{3}-\d{4}|[都道府県市区町村][^\s,;。]{1,40}\d{1,5}(?:丁目|番地|番|[-‐−])/u;
const addressRegions: Record<string, RegExp> = {
  미국: /\b(?:AL|AK|AZ|AR|CA|CO|CT|DE|DC|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\s+\d{5}(?:-\d{4})?\b/u,
  대한민국: /경기도|부산광역시|대구광역시|인천광역시|광주광역시|대전광역시|울산광역시|세종특별자치시|\brep of korea\b/iu,
  일본: /愛知県|豊田市|文京区|大阪府|京都府|北海道|神奈川県|福岡県/u,
  베트남: /Việt Nam|Hà Nội/iu,
};

function findLiveCountries(sources: Source[], names: string[]): string[] {
  const namePatterns = [...names].sort((left, right) => right.length - left.length).filter(Boolean)
    .map((name) => new RegExp(name.normalize("NFKC").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "giu"));
  const found = new Set<string>();
  for (const { title, description } of sources) {
    // Keep street/country abbreviations inside the same address sentence.
    const sentences = [title, description].flatMap((text) => text.normalize("NFKC")
      .replace(/\bU\.S(?:\.A)?\./giu, "USA")
      .replace(/\b(st|rd|ave|blvd|dr|ln|pl|ct|sq|pkwy|rep|no)\.(?=\s|,)/giu, "$1")
      .split(/(?<=[.!?])\s+|[。！？\r\n;|·•]/u));
    for (const sentence of sentences) {
      if (unrelatedLocationCue.test(sentence) || nonPhysicalContext.test(sentence)) continue;
      const street = streetPatterns.find((pattern) => pattern.test(sentence));
      if (!physicalLocationCue.test(sentence) && !street && !eastAsianStreet.test(sentence)) continue;
      // Place names within the institution or street name do not identify the address locality.
      const locality = street ? sentence.replace(street, " ") : sentence;
      const content = namePatterns.reduce((text, pattern) => text.replace(pattern, " "), locality);
      for (const [country, [, , , pattern]] of Object.entries(locales)) {
        if (pattern.test(content) || addressRegions[country]?.test(content)) found.add(country);
      }
    }
  }
  return Object.keys(locales).filter((country) => found.has(country));
}

function domainEvidence(institution: string, email: string, official: Source[], names: string[], domains: string[], sources: Source[]): [AssessmentDetails["domain"], string[]] {
  const match = /^[^\s@]+@([a-z0-9]+(?:[.-][a-z0-9]+)+)$/i.exec(email.trim());
  const emailDomain = match?.[1].toLowerCase();
  if (!emailDomain) return ["unverified", []];
  if (freeEmailDomains.some((domain) => matchesDomain(emailDomain, domain))) return ["free-email", []];

  const aliases = forwardingPolicy.institutionDomainAliases.filter((alias) => alias.institution === institution);
  const alias = aliases.find((row) => matchesDomain(emailDomain, row.emailDomain));
  if (alias) return ["matched", [alias.source]];
  const accepted = domains.filter((domain) => official.some((source) => matchesDomain(hostOf(source), domain)));
  if (accepted.some((domain) => matchesDomain(emailDomain, domain))) return ["matched", []];

  const otherInstitution = Object.entries(institutionProfiles).some(([name, profile]) =>
    name !== institution && profile.domains.some((domain) =>
      matchesDomain(emailDomain, domain) && !domains.some((candidate) => matchesDomain(candidate, domain))
      && sources.some((source) => matchesDomain(hostOf(source), domain))));
  const nameWords = names.flatMap((name) => institutionalName(name).split(" ")).filter((word) =>
    word.length >= 4 && !genericNameTerms.has(word));
  const brandNames = [...nameWords, ...domains.map((domain) => domain.split(".")[0])];
  const candidate = compact(emailDomain);
  const lookalike = accepted.length > 0 && !domains.some((domain) => matchesDomain(emailDomain, domain)) && brandNames.some((name) =>
    name.length >= 3 && candidate.includes(compact(name)));
  return [otherInstitution || lookalike ? "suspicious" : "unverified", []];
}

export function classifyLead(lead: LeadInput, evidence: SearchEvidence): { assessment: Assessment; workflow: WorkflowState } {
  const { matching, official, names, domains } = affiliatedSources(lead.institution, evidence.sources);
  const [domain, aliasSources] = domainEvidence(lead.institution, lead.email, official, names, domains, evidence.sources);
  const intent = intentRules.map(([name, pattern]) => [name, lead.memo.match(pattern)?.[0]] as const)
    .find(([, match]) => match);
  const memoIntent = intent?.[0] ?? "unknown";
  const external = evidence.kind === "liner" || evidence.kind === "cache" || evidence.kind === "mixed";
  const countries = external ? findLiveCountries(official, names) : findCountries(official, names);
  const industryText = official.map(({ title, description }) => title + " " + description).join(" ");
  const industry = industryRules.find(([, pattern]) => pattern.test(industryText))?.[0] ?? null;
  const result = (verdict: Verdict, reason: string) => ({
    assessment: {
      verdict, reason,
      sources: [...new Set([...official.map(({ url }) => url), ...aliasSources, ...matching.map(({ url }) => url), ...evidence.sources.map(({ url }) => url)])],
      searchedAt: evidence.searchedAt,
      mode: evidence.kind === "liner" || evidence.kind === "mixed" ? "live" as const : "saved" as const,
      details: { domain, countries, industry, memoIntent, memoQuote: intent?.[1] ?? null,
        externalStatus: evidence.status, sourceKind: evidence.kind },
    },
    workflow: verdict === "country-check" || verdict === "partnership-check" ? "reply-pending" as const : "decision-pending" as const,
  });

  if (!lead.institution.trim() || /^(?:individual|none|n\/?a|개인|없음)$/iu.test(lead.institution.trim())) {
    return result("invalid", "확인 가능한 소속 기관이 없습니다.");
  }
  if (memoIntent === "sales") return result("invalid", "제품 구매 문의 대신 영업 제안으로 확인됐어요.");
  if (memoIntent === "student") return result("invalid", "과제나 논문 자료 요청으로 확인됐어요.");
  if (memoIntent === "job") return result("invalid", "채용 문의로 확인됐어요.");
  if (evidence.status === "complete" && matching.length === 0) return result("invalid", "공개 정보에서 기관을 찾지 못함");
  if (evidence.status === "failed") return result("ambiguous", "외부 확인 실패, 다시 시도");
  if (domain === "suspicious") return result("invalid", "이메일이 기관 공식 도메인과 다른 닮은꼴 또는 타기관 도메인입니다.");
  if (evidence.status === "saved-unavailable") return result("ambiguous", "저장된 기관 근거가 없어 확인이 필요해요.");
  if (official.length === 0) return result("ambiguous", "기관 공식 페이지를 확인하지 못했어요.");
  if (domain === "free-email") return result("ambiguous", "무료 이메일로는 기관 소속을 확인하기 어려워요.");
  if (domain === "unverified") return result("ambiguous", "이메일 도메인과 기관의 관계를 확인하지 못했어요.");
  if (countries.length !== 1) return result("ambiguous", "기관 소재지를 한 나라로 확인하지 못했어요.");
  if (countries[0] !== lead.country) return result("country-check", "기관 소재지가 리드 국가와 달라 회신으로 확인이 필요해요.");
  if (memoIntent === "partnership") return result("partnership-check", "제휴 제안의 자세한 내용을 확인해야 해요.");
  if (memoIntent === "buying") return result("valid", "소속 기관과 이메일 도메인이 확인됐고 제품 구매·검토 의향이 있어요.");
  return result("ambiguous", "문의 의도를 전화로 확인해야 해요.");
}
