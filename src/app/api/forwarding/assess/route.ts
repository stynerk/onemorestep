import { isPublicDemo, linerRuntimeSettings } from "../../../../lib/demo-mode";
import { createAssessmentService } from "../../../../lib/forwarding/assessment-service";
import { locales } from "../../../../lib/forwarding/institution-policy";
import { assessSavedIndustryLead, getSavedIndustry } from "../../../../lib/forwarding/industry-demo.server";
import { lookupSavedInquiryIntent, requestInquiryIntent } from "../../../../lib/forwarding/intent-router";
import { savedInquiryIntents } from "../../../../lib/forwarding/saved-inquiry-intents";
import { createInitialForwardingState } from "../../../../lib/forwarding/seed";

export const runtime = "nodejs";

const leads = new Map(createInitialForwardingState().leads.map((lead) => [lead.id, lead]));
const service = createAssessmentService();
const headers = { "Cache-Control": "no-store" };

export async function POST(request: Request): Promise<Response> {
  if (request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return Response.json({ error: "JSON 요청이 필요합니다." }, { status: 415, headers });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "올바른 JSON 요청이 필요합니다." }, { status: 400, headers });
  }
  if (body === null || typeof body !== "object" || !("leadId" in body) || typeof body.leadId !== "string"
    || Object.keys(body).some((key) => key !== "leadId" && key !== "country" && key !== "partnershipPurchase" && key !== "industry")) {
    return Response.json({ error: "시연 리드 ID를 입력해 주세요." }, { status: 400, headers });
  }
  const industry = "industry" in body ? body.industry : "medicom";
  if (typeof industry !== "string") return Response.json({ error: "시연 업종을 확인해 주세요." }, { status: 400, headers });
  const publicDemo = isPublicDemo();
  const saved = industry !== "medicom" && publicDemo ? getSavedIndustry(industry) : undefined;
  if (industry !== "medicom" && !saved) return Response.json({ error: "선택할 수 있는 시연 업종이 아닙니다." }, { status: 404, headers });
  const lead = saved ? saved.demo.seed.leads.find((row) => row.id === body.leadId) : leads.get(body.leadId);
  if (!lead) return Response.json({ error: "시연 리드를 찾지 못했습니다." }, { status: 404, headers });
  let country = lead.country;
  if ("country" in body) {
    if (typeof body.country !== "string" || !Object.hasOwn(locales, body.country)) {
      return Response.json({ error: "지원하는 국가를 입력해 주세요." }, { status: 400, headers });
    }
    country = body.country;
  }
  if ("partnershipPurchase" in body && body.partnershipPurchase !== true) {
    return Response.json({ error: "회신 유형을 확인해 주세요." }, { status: 400, headers });
  }
  // The submitted reply note stays in browser storage. Only the confirmed intent changes.
  const confirmedPurchase = "partnershipPurchase" in body;
  const memo = confirmedPurchase ? "회신에서 구매 견적 요청을 확인함" : lead.memo;
  const input = { ...lead, country, memo };
  const runtime = linerRuntimeSettings();
  // Public assessment only uses recorded Router output. A confirmed reply already gives the intent.
  const intent = confirmedPurchase ? null : publicDemo ? lookupSavedInquiryIntent(memo, savedInquiryIntents)
    : runtime.mode?.trim() === "live" && lead.institution.trim() ? requestInquiryIntent(memo, runtime) : null;
  const result = saved ? assessSavedIndustryLead(saved, input, lead.country, await intent)
    : await service.assess(input, { ...runtime, regionalCountry: lead.country, intent });
  return Response.json({ leadId: lead.id, ...result }, { headers });
}
