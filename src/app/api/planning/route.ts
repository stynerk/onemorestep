import { proposeWorkflow } from "../../../lib/planning";
import { aiMode, modelConfig } from "../../../lib/providers/config";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try { body = await request.json(); } catch {
    return Response.json({ error: "올바른 JSON 요청이 필요합니다." }, { status: 400 });
  }
  try {
    const result = await proposeWorkflow(body, { mode: aiMode(process.env), config: modelConfig(process.env) });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "회사 맥락·변경 내용·기존 작업·근거와 revision을 확인해 주세요." }, { status: 400 });
  }
}
