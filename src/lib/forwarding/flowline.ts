import type { DemoIndustry } from "./industry-demo";
import { forwardingPolicy } from "./policy";
import type { DealerDelivery, DealerOutcome, LeadInput, WorkflowPolicy } from "./types";

// Operational rows from docs/product/INDUSTRY2_DATA.md. Answers are read by the offline evaluation only.
const leadRows = [
  ["I01", "Siemens AG", "mrn-saas-01@siemens.com", "독일", "FL-Enterprise", "We are evaluating a workflow platform for 2,000 users and need a quote"],
  ["I02", "LG Electronics (LG전자)", "mrn-saas-02@lge.com", "대한민국", "FL-Team", "사내 300명 규모 도입을 검토 중입니다. 견적과 데모 요청드립니다"],
  ["I03", "Hitachi, Ltd.", "mrn-saas-03@hitachi.com", "일본", "FL-Enterprise", "全社導入を検討しています。見積もりをお願いします"],
  ["I04", "BASF SE", "mrn-saas-04@gmail.com", "독일", "FL-Team", "price?"],
  ["I05", "Max Planck Society", "mrn-saas-05@gv.mpg.de", "미국", "FL-API", "Need API access licenses for our lab, please send pricing"],
  ["I06", "Robert Bosch GmbH", "mrn-saas-06@de.bosch.com", "독일", "FL-Enterprise", "We'd like to discuss a reseller partnership for Germany"],
  ["I07", "University of Toronto", "mrn-saas-07@utoronto.ca", "캐나다", "FL-Team", "Course project: I'm comparing workflow SaaS pricing for my report"],
  ["I08", "Brightwave Analytics", "mrn-saas-08@brightwave.test", "미국", "FL-Team", "We plan to buy 500 seats this quarter"],
  ["I09", "Siemens AG", "mrn-saas-09@siemens-procurement.test", "독일", "FL-Enterprise", "Urgent license order, payment in advance, reply to this address only"],
  ["I10", "Roche", "mrn-saas-10@roche.com", "미국", "FL-Team", "I'd like to apply for your solutions engineer opening"],
] as const;

const leads: LeadInput[] = leadRows.map(([id, institution, email, country, product, memo], index) => ({
  id, institution, email, country, product, memo,
  name: "mrn-saas-" + id.slice(1),
  phone: "DEMO-NOT-A-PHONE-" + id,
  receivedAt: new Date(Date.UTC(2026, 10, 18, 0, index * 5)).toISOString(),
}));

const products = ["FL-Team", "FL-Enterprise", "FL-API"];
const customerIndustries = ["제조", "금융", "IT 서비스", "연구기관", "공공"];
const policy = {
  aggregationDays: 90,
  minimumForwardedCount: 3,
  responseBusinessDays: 1,
  responseTimeZone: "Asia/Seoul",
  weights: { noResponse: -0.1, priorRelationship: 0.1 },
  referenceDate: forwardingPolicy.referenceDate,
  countryRegions: { 대한민국: "APAC", 일본: "APAC", 싱가포르: "APAC", 미국: "NA", 캐나다: "NA", 독일: "EU" },
  managers: forwardingPolicy.managers,
  customerIndustries: Object.fromEntries(products.map((product) => [product, [...customerIndustries]])),
} satisfies WorkflowPolicy;

// The four counts are deal, no-deal, in-progress and no-response.
const partnerRows = [
  ["flowline-seoul", "Seoul Cloud Partners", "대한민국", 3, 4, 1, 0],
  ["flowline-k-integrate", "K-Integrate", "대한민국", 1, 2, 0, 3],
  ["flowline-tokyo", "Tokyo SI Works", "일본", 3, 3, 1, 0],
  ["flowline-pacific", "Pacific Cloud Resellers", "미국", 2, 3, 0, 1],
  ["flowline-bay", "Bay Systems Group", "미국", 3, 3, 1, 0],
  ["flowline-rhein", "Rhein Digital GmbH", "독일", 2, 2, 1, 0],
  ["flowline-merlion", "Merlion Cloud Pte", "싱가포르", 1, 1, 0, 0],
] as const;
const outcomes: DealerOutcome[] = ["deal", "no-deal", "in-progress", "no-response"];
const historyStart = Date.UTC(2026, 7, 20);
const historyEnd = Date.UTC(2026, 10, 17);

function historicalDeliveries(): DealerDelivery[] {
  const rows = partnerRows.flatMap(([dealerId, , , ...counts]) => counts.flatMap((count, index) =>
    Array.from({ length: count }, () => ({ dealerId, outcome: outcomes[index] }))));
  return rows.map(({ dealerId, outcome }, index) => {
    const indexId = String(index + 1).padStart(3, "0");
    return {
      id: "flowline-delivery-" + indexId,
      leadId: "flowline-history-" + indexId,
      dealerId,
      institution: "Flowline Synthetic Historical Institution " + indexId,
      forwardedAt: new Date(Math.round(historyStart + index * (historyEnd - historyStart) / (rows.length - 1))).toISOString(),
      outcome,
    };
  });
}

export const flowline = {
  id: "b2b-saas",
  label: "B2B SaaS",
  brand: "Flowline",
  dealer: "파트너",
  seed: {
    leads,
    dealers: partnerRows.map(([id, name, country]) => ({ id, name, countries: [country], products: [...products], active: true })),
    deliveries: historicalDeliveries(),
    priorRelationships: [{ dealerId: "flowline-k-integrate", institution: "LG Electronics (LG전자)" }],
    policy,
  },
} satisfies Extract<DemoIndustry, { id: "b2b-saas" }>;
