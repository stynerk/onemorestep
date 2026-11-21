import type { Source } from "../liner-search";
import { handoffForAssessment } from "./handoff";
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

const researchCollaboration = /공동\s*연구|연구\s*(?:협업|협력)|共同研究|研究(?:協力|連携)|\b(?:joint research|research collaborat(?:ion|ive)|collaborat\w* (?:on|in) research)\b/iu;
const institutionalResearchContext = /본교|본원|당사|학과|연구실|연구팀|연구소|当院|本学|研究室|\b(?:university|hospital|department|laboratory|lab|faculty|institutional|research (?:team|institute))\b/iu;
const personalStudy = /(?:학생\s*)?개인(?:의|적(?:인)?)?\s*(?:과제|논문|연구)|졸업\s*논문|수업\s*과제|卒業論文|個人(?:の)?(?:課題|研究|論文)|\b(?:class project|student assignment|homework|(?:my|personal|individual)\s+(?:(?:graduate|final|school|class)\s+)?(?:assignment|project|thesis|dissertation|research))\b/iu;

function memoMatch(memo: string) {
  const first = intentRules.map(([name, pattern]) => [name, memo.match(pattern)?.[0]] as const).find(([, match]) => match);
  if (first?.[0] === "job" || first?.[0] === "sales") return first;
  const personal = memo.match(personalStudy)?.[0];
  if (personal) return ["student", personal] as const;
  const collaboration = memo.match(researchCollaboration)?.[0];
  if (collaboration && (first?.[0] !== "student" || institutionalResearchContext.test(memo))) return ["partnership", collaboration] as const;
  return first;
}

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
const genericVariantTerms = new Set([...genericNameTerms, "research", "institute", "laboratory", "school", "college", "regional", "national", "health", "healthcare", "inc", "ltd", "llc"]);
const genericHostTerms = new Set([...genericVariantTerms, "system", "systems"]);
const institutionalName = (value: string) => value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const genericNameVariants = new Set(["병원", "대학", "대학교", "의원", "연구소", "病院", "大学", "診療所", "研究所"].map(institutionalName));
const variantSeparator = /[()[\]\/|]|\s+[-–—]\s+/u;
const scriptSeparator = /(?<=\p{Script=Latin})\s+(?=[\p{Script=Hangul}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])|(?<=[\p{Script=Hangul}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])\s+(?=\p{Script=Latin})/u;
const compact = (value: string) => institutionalName(value).replace(/ /g, "");
const matchesName = (text: string, name: string) => {
  const normalized = institutionalName(name);
  return normalized.length > 0 && (" " + institutionalName(text) + " ").includes(" " + normalized + " ");
};
const hostOf = (source: Source) => new URL(source.url).hostname.replace(/\.$/u, "");
const reservedDomains = ["example", "example.com", "example.net", "example.org", "test", "invalid", "localhost"];
const excludedInstitutionalDomains = [...freeEmailDomains, ...reservedDomains, ...thirdPartyDomains];
const spamPromotion = /\b(?:buy (?:social media followers|backlinks)|guaranteed (?:investment returns|profits)|casino bonus|crypto airdrop)\b|팔로워\s*구매|수익\s*보장|フォロワー購入/iu;

export function matchesDomain(host: string, domain: string): boolean {
  return host === domain || host.endsWith("." + domain);
}

function relatedHosts(left: string, right: string): boolean {
  return matchesDomain(left, right) || matchesDomain(right, left);
}

function isInstitutionalHost(host: string): boolean {
  return !excludedInstitutionalDomains.some((domain) => matchesDomain(host, domain))
    && !host.split(".").some((label) => /^(?:news|wiki|directory|directories|social)$/u.test(label));
}

function resemblesInstitutionHost(emailDomain: string, host: string, names: string[]): boolean {
  const emailLabels = emailDomain.split(".").map(compact);
  const sharedBrandWords = names.flatMap((name) => institutionalName(name).split(" ")).filter((word) =>
    word.length >= 4 && !genericVariantTerms.has(word) && emailLabels.some((label) => label.includes(word)));
  const sourceLabels = host.split(".");
  const brandedLabel = sourceLabels.findLastIndex((label) => sharedBrandWords.some((word) => compact(label).includes(word)));
  // Sibling subdomains under the same branded domain do not suggest impersonation.
  return brandedLabel >= 0 && !matchesDomain(emailDomain, sourceLabels.slice(brandedLabel).join("."));
}

function titleAndHostIdentifyInstitution(title: string, host: string, names: string[]): boolean {
  const normalizedTitle = institutionalName(title);
  const hostWords = institutionalName(host.split(".").slice(0, -1).join(" ")).split(" ");
  return names.some((name) => {
    const normalizedName = institutionalName(name);
    if (!normalizedName || (normalizedTitle !== normalizedName && !normalizedTitle.startsWith(normalizedName + " "))) return false;

    const nameWords = normalizedName.split(" ");
    const distinctiveWords = nameWords.filter((word) => word.length >= 4 && !genericHostTerms.has(word));
    if (distinctiveWords.length === 0) return false;

    return distinctiveWords.some((word) => hostWords.includes(word))
      || hostWords.includes(nameWords.join(""))
      || nameWords.slice(1).some((word, index) => {
        const previousWord = nameWords[index];
        return distinctiveWords.includes(previousWord) && distinctiveWords.includes(word) && hostWords.includes(previousWord + word);
      });
  });
}

function namesFor(institution: string, includeVariants: boolean) {
  const profile = Object.hasOwn(institutionProfiles, institution) ? institutionProfiles[institution] : undefined;
  const variants = includeVariants
    ? institution.normalize("NFKC").split(variantSeparator).flatMap((name) => name.split(scriptSeparator))
      .map((name) => name.trim())
      .filter((name) => {
        const normalized = institutionalName(name);
        return normalized.length >= 3 && !genericNameVariants.has(normalized)
          && normalized.split(" ").some((term) => !genericVariantTerms.has(term));
      })
    : [];
  return { names: [...new Set([institution, ...(profile?.names ?? []), ...variants])], domains: profile?.domains ?? [] };
}

function affiliatedSources(institution: string, sources: Source[], includeVariants: boolean) {
  const { names, domains } = namesFor(institution, includeVariants);
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
const institutionCategory = /\b(?:hospitals?|clinics?|universit(?:y|ies)|colleges?|institutes?|laborator(?:y|ies)|foundations?|associations?|corporations?|companies|company|organi[sz]ations?|ministr(?:y|ies)|government agenc(?:y|ies))\b|병원|의원|대학교|연구소|재단|협회|기업|病院|診療所|大学|研究所|財団|協会/iu;

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

function countriesFromDomains(official: Source[], verifiedAlias: string | undefined): string[] {
  const hosts = official.map(hostOf);
  if (verifiedAlias) hosts.push(verifiedAlias);
  const suffixes = new Set(hosts.map((host) => host.split(".").at(-1)));
  // Use only supported country codes. The British DNS suffix is .uk, not the search locale code gb.
  return Object.entries(locales).flatMap(([country, [, , code]]) => suffixes.has(code === "gb" ? "uk" : code) ? [country] : []);
}

function domainEvidence(institution: string, emailDomain: string | undefined, official: Source[], names: string[], domains: string[], sources: Source[]): [AssessmentDetails["domain"], string[], string?] {
  if (!emailDomain) return ["unverified", []];
  if (freeEmailDomains.some((domain) => matchesDomain(emailDomain, domain))) return ["free-email", []];

  const aliases = forwardingPolicy.institutionDomainAliases.filter((alias) => alias.institution === institution);
  const alias = aliases.find((row) => matchesDomain(emailDomain, row.emailDomain));
  if (alias) return ["matched", [alias.source], alias.emailDomain];
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

export function classifyLead(lead: LeadInput, evidence: SearchEvidence, regionalCountry = lead.country): { assessment: Assessment; workflow: WorkflowState } {
  const liveEvidence = evidence.kind === "liner" || evidence.kind === "cache" || evidence.kind === "mixed";
  const completeLiveEvidence = liveEvidence && evidence.status === "complete";
  const emailDomain = /^[^\s@]+@([a-z0-9]+(?:[.-][a-z0-9]+)+)$/i.exec(lead.email.trim())?.[1].toLowerCase();
  const reservedEmail = emailDomain !== undefined && reservedDomains.some((domain) => matchesDomain(emailDomain, domain));
  const institutionalEmailDomain = emailDomain && /\.[a-z]{2,}$/u.test(emailDomain) && isInstitutionalHost(emailDomain) ? emailDomain : undefined;
  const { matching, official: configuredOfficial, names, domains } = affiliatedSources(lead.institution, evidence.sources, completeLiveEvidence);
  const [configuredDomain, aliasSources, verifiedAlias] = domainEvidence(lead.institution, emailDomain, configuredOfficial, names, domains, evidence.sources);
  const publicInstitutionSources = completeLiveEvidence && configuredDomain === "unverified" && emailDomain
    ? matching.filter((source) => isInstitutionalHost(hostOf(source)))
    : [];
  // Keep configured ownership and impersonation checks ahead of inference for new institutions.
  const inferredOfficial = domains.length === 0 && institutionalEmailDomain
    ? publicInstitutionSources.filter((source) => relatedHosts(hostOf(source), institutionalEmailDomain))
    : [];
  const suspectPublicMismatch = emailDomain !== undefined && inferredOfficial.length === 0
    && publicInstitutionSources.some((source) => {
      const host = hostOf(source);
      if (relatedHosts(host, emailDomain)) return false;
      if (!reservedEmail) return resemblesInstitutionHost(emailDomain, host, names);
      // Short institution names may also occur as unrelated acronyms in search results.
      return configuredOfficial.includes(source) || institutionCategory.test(source.title + " " + source.description)
        || findCountries([source], names).length > 0 || titleAndHostIdentifyInstitution(source.title, host, names);
    });
  const official = inferredOfficial.length > 0 ? inferredOfficial : configuredOfficial;
  const domain = inferredOfficial.length > 0 ? "matched" : suspectPublicMismatch ? "suspicious" : configuredDomain;
  const intent = memoMatch(lead.memo);
  const memoIntent = intent?.[0] ?? "unknown";
  const textCountries = findCountries(official, names);
  const domainCountries = completeLiveEvidence && textCountries.length === 0
    && official.length > 0 && domain === "matched" ? countriesFromDomains(official, verifiedAlias) : [];
  const countries = textCountries.length > 0 ? textCountries : domainCountries;
  const domainReason = domainCountries.length === 1 ? " 기관 소재지는 확인된 기관 도메인의 국가 코드를 근거로 추정했어요." : "";
  const industryText = official.map(({ title, description }) => title + " " + description).join(" ");
  const industry = industryRules.find(([, pattern]) => pattern.test(industryText))?.[0] ?? null;
  const result = (verdict: Verdict, reason: string) => ({
    assessment: {
      verdict, reason,
      handoff: handoffForAssessment(lead, verdict, memoIntent, regionalCountry),
      sources: [...new Set([...official.map(({ url }) => url), ...aliasSources, ...matching.map(({ url }) => url), ...evidence.sources.map(({ url }) => url)])],
      searchedAt: evidence.searchedAt,
      mode: evidence.kind === "liner" || evidence.kind === "mixed" ? "live" as const : "saved" as const,
      details: { domain, countries, industry, memoIntent, memoQuote: intent?.[1] ?? null,
        externalStatus: evidence.status, sourceKind: evidence.kind },
    },
    workflow: verdict === "country-check" || verdict === "partnership-check" ? "reply-pending" as const : "decision-pending" as const,
  });

  if (memoIntent === "job") return result("invalid", "채용 문의로 확인됐어요.");
  if (!lead.institution.trim() || /^(?:individual|none|n\/?a|개인|없음)$/iu.test(lead.institution.trim())) {
    return result("invalid", "확인 가능한 소속 기관이 없습니다.");
  }
  if (memoIntent === "sales") return result("invalid", "제품 구매 문의 대신 영업 제안으로 확인됐어요.");
  if (memoIntent === "student") return result("invalid", "과제나 논문 자료 요청으로 확인됐어요.");
  if (completeLiveEvidence && spamPromotion.test(lead.memo)) return result("invalid", "스팸성 홍보 문의로 확인됐어요.");
  if (evidence.status === "complete" && matching.length === 0 && !completeLiveEvidence) return result("invalid", "공개 정보에서 기관을 찾지 못함");
  if (evidence.status === "failed") {
    const warning = domain === "suspicious" ? " 이메일 도메인의 사칭 의심도 확인해 주세요." : "";
    return result("ambiguous", "외부 확인 실패, 다시 시도" + warning);
  }
  if (domain === "suspicious") {
    if (suspectPublicMismatch) return result("ambiguous", "공개 출처에서 기관을 확인했지만 이메일 도메인이 달라 사칭 여부를 확인해야 해요.");
    return result("ambiguous", "이메일이 공식 도메인과 다른 닮은꼴 또는 타기관 도메인이어서 사칭 의심으로 분류했어요.");
  }
  if (completeLiveEvidence && domains.length === 0 && reservedEmail) {
    return result("invalid", "예시용 또는 테스트 이메일 주소로 기관 소속을 확인할 수 없어요.");
  }
  if (completeLiveEvidence && matching.length === 0) {
    // A completed search can miss a real institution, even when a buyer uses a plausible work address.
    return memoIntent === "buying" && institutionalEmailDomain
      ? result("ambiguous", "공개 검색에서 기관을 확인하지 못해 구매 문의와 소속을 다시 확인해야 해요.")
      : result("invalid", "공개 정보에서 기관을 찾지 못함");
  }
  if (evidence.status === "saved-unavailable") return result("ambiguous", "저장된 기관 근거가 없어 확인이 필요해요.");
  if (official.length === 0) return result("ambiguous", "기관 공식 페이지를 확인하지 못했어요.");
  if (domain === "free-email") return result("ambiguous", "무료 이메일로는 기관 소속을 확인하기 어려워요.");
  if (domain === "unverified") return result("ambiguous", "이메일 도메인과 기관의 관계를 확인하지 못했어요.");
  if (liveEvidence && countries.length !== 1 && memoIntent === "partnership") {
    return result("partnership-check", "제휴 제안의 자세한 내용과 기관 소재지를 확인해야 해요.");
  }
  if (countries.length !== 1) return result("ambiguous", "기관 소재지를 한 나라로 확인하지 못했어요.");
  if (countries[0] !== lead.country) return result("country-check", "기관 소재지가 리드 국가와 달라 회신으로 확인이 필요해요." + domainReason);
  if (memoIntent === "partnership") return result("partnership-check", "제휴 제안의 자세한 내용을 확인해야 해요." + domainReason);
  if (memoIntent === "buying") return result("valid", "소속 기관과 이메일 도메인이 확인됐고 제품 구매·검토 의향이 있어요." + domainReason);
  return result("ambiguous", "문의 의도를 전화로 확인해야 해요.");
}
