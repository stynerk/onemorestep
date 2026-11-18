import leadRows from "./seed-leads.json";
import type { Dealer, DealerDelivery, DealerOutcome, ForwardingState, LeadInput, PriorRelationship } from "./types";

export const DEMO_DATA_REVISION = "1da2b587b393b4e627338fada671031965c12c41";

// Product coverage is synthetic: the source does not restrict any demonstration dealer.
const dealers: Dealer[] = [
  { id: "dealer-a", name: "A Medical", countries: ["대한민국"], products: ["PM-50", "US-200", "IS-3"], active: true },
  { id: "dealer-d", name: "D Medi", countries: ["대한민국"], products: ["PM-50", "US-200", "IS-3"], active: true },
  { id: "dealer-j", name: "J Medica", countries: ["일본"], products: ["PM-50", "US-200", "IS-3"], active: true },
  { id: "dealer-u", name: "U Health Supply", countries: ["미국"], products: ["PM-50", "US-200", "IS-3"], active: true },
  { id: "dealer-v", name: "V MedSource", countries: ["미국"], products: ["PM-50", "US-200", "IS-3"], active: true },
  { id: "dealer-e", name: "E Medtech GmbH", countries: ["독일"], products: ["PM-50", "US-200", "IS-3"], active: true },
  { id: "dealer-s", name: "S Medical Pte", countries: ["싱가포르"], products: ["PM-50", "US-200", "IS-3"], active: true },
];

// Fictional DEMO_DATA dealer counts. Scene 6 (#30) changes one V MedSource deal to no-deal.
const deliveryCounts = [
  ["dealer-a", 3, 4, 1, 0], ["dealer-d", 1, 2, 0, 3], ["dealer-j", 3, 3, 1, 0],
  ["dealer-u", 2, 3, 0, 1], ["dealer-v", 2, 4, 1, 0], ["dealer-e", 2, 2, 1, 0], ["dealer-s", 1, 1, 0, 0],
] as const;
const outcomes: DealerOutcome[] = ["deal", "no-deal", "in-progress", "no-response"];

function createDeliveries(): DealerDelivery[] {
  const rows: DealerDelivery[] = [];
  for (const [dealerId, ...counts] of deliveryCounts) {
    counts.forEach((count, outcomeIndex) => {
      for (let index = 0; index < count; index += 1) {
        const number = rows.length + 1;
        rows.push({
          id: `delivery-${String(number).padStart(3, "0")}`,
          dealerId,
          leadId: `historical-${String(number).padStart(3, "0")}`,
          institution: `Synthetic Historical Institution ${number}`,
          forwardedAt: new Date(Date.UTC(2026, 7, 20 + (number - 1) * 2)).toISOString(),
          outcome: outcomes[outcomeIndex],
        });
      }
    });
  }
  return rows;
}

// Fictional older relationships, separate from the non-overlapping 90-day delivery rows.
const priorRelationships: PriorRelationship[] = [
  { dealerId: "dealer-a", institution: "서울대학교병원" },
  { dealerId: "dealer-d", institution: "강남세브란스병원" },
];

/** A fresh operational snapshot. Never imports or exposes evaluation answers. */
export function createInitialForwardingState(): ForwardingState {
  const leads: LeadInput[] = leadRows.map((row) => ({
    id: row.id, name: row.name, email: row.email, phone: row.phone,
    institution: row.institution, country: row.country, product: row.product as LeadInput["product"],
    memo: row.memo, receivedAt: row.receivedAt,
  }));
  return {
    leads,
    dealers: structuredClone(dealers),
    deliveries: createDeliveries(),
    priorRelationships: structuredClone(priorRelationships),
    leadStates: Object.fromEntries(leads.map((lead) => [lead.id, { leadId: lead.id, assessment: null, workflow: "new", dealerId: null }])),
    events: [],
  };
}
