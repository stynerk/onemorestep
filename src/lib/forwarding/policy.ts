import type { Product, Region } from "./types";

/** Demonstration policy, not measured company statistics. Edit here; no settings UI in #28. */
export const forwardingPolicy = {
  aggregationDays: 90,
  minimumForwardedCount: 3,
  responseBusinessDays: 1,
  responseTimeZone: "Asia/Seoul",
  weights: { noResponse: -0.1, priorRelationship: 0.1 },
  referenceDate: "2026-11-18T00:00:00.000Z",
  customerIndustries: {
    "PM-50": ["병원·의원", "연구소", "대학 연구실", "제약·바이오", "의료기기 유통"],
    "US-200": ["병원·의원", "연구소", "대학 연구실", "제약·바이오", "의료기기 유통"],
    "IS-3": ["치과", "연구소", "대학 연구실", "의료기기 유통"],
  } satisfies Record<Product, string[]>,
  countryRegions: {
    대한민국: "APAC", 일본: "APAC", 싱가포르: "APAC", 호주: "APAC", 베트남: "APAC", 인도: "APAC",
    미국: "NA", 캐나다: "NA", 멕시코: "LATAM", 브라질: "LATAM",
    독일: "EU", 프랑스: "EU", 영국: "EU", 스웨덴: "EU", 아랍에미리트: "MEA",
    스위스: "EU", 스페인: "EU", 네덜란드: "EU", 콜롬비아: "LATAM", 이스라엘: "MEA",
  } satisfies Record<string, Region>,
  managers: [
    { id: "manager-na", name: "담당 NA", region: "NA" },
    { id: "manager-latam", name: "담당 LATAM", region: "LATAM" },
    { id: "manager-apac", name: "담당 APAC", region: "APAC" },
    { id: "manager-eu", name: "담당 EU", region: "EU" },
    { id: "manager-mea", name: "담당 MEA", region: "MEA" },
  ],
  institutionDomainAliases: [
    { institution: "Cleveland Clinic", siteDomain: "clevelandclinic.org", emailDomain: "ccf.org", source: "https://my.clevelandclinic.org/about-cleveland-clinic/about-this-website/privacy-security" },
    { institution: "The Royal Melbourne Hospital", siteDomain: "thermh.org.au", emailDomain: "mh.org.au", source: "https://www.thermh.org.au/contact" },
    { institution: "Guy's and St Thomas' NHS Foundation Trust", siteDomain: "guysandstthomas.nhs.uk", emailDomain: "gstt.nhs.uk", source: "https://www.guysandstthomas.nhs.uk/contact-us" },
    { institution: "Toyota Motor Corporation", siteDomain: "global.toyota", emailDomain: "mail.toyota.co.jp", source: "https://global.toyota/en/privacy-notice/" },
    { institution: "강남세브란스병원", siteDomain: "severance.healthcare", emailDomain: "yuhs.ac", source: "https://sev.severance.healthcare/sev/story/donate/info.do" },
  ],
} as const;
