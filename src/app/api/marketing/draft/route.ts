import { isPublicDemo, linerRuntimeSettings } from "../../../../lib/demo-mode";
import { getMarketingDraft } from "../../../../lib/marketing/marketing-drafts.server";
import { marketingChannels, marketingRequests } from "../../../../lib/marketing/policy";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };
const maximumBodyBytes = 512;

async function draftRequestBody(request: Request): Promise<unknown> {
  if (!request.body) return null;
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let total = 0;
  let body = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return JSON.parse(body + decoder.decode());
      total += value.byteLength;
      if (total > maximumBodyBytes) {
        await reader.cancel();
        return null;
      }
      body += decoder.decode(value, { stream: true });
    }
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

export async function POST(request: Request): Promise<Response> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return Response.json({ error: "JSON 요청이 필요합니다." }, { status: 415, headers });
  }
  const body = await draftRequestBody(request);
  if (typeof body !== "object" || body === null || Array.isArray(body) || !("requestId" in body) || !("channel" in body)
    || Object.keys(body).length !== 2 || !marketingRequests.some(({ id }) => id === body.requestId)) {
    return Response.json({ error: "마케팅 요청을 확인해 주세요." }, { status: 400, headers });
  }
  const channel = marketingChannels.find(({ id }) => id === body.channel);
  if (!channel || typeof body.requestId !== "string") {
    return Response.json({ error: "초안 채널을 확인해 주세요." }, { status: 400, headers });
  }
  const draft = await getMarketingDraft(body.requestId, channel.id, { ...linerRuntimeSettings(), publicDemo: isPublicDemo() });
  return Response.json(draft, { headers });
}
