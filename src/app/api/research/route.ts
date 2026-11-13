import { research, validQuery } from "../../../lib/research";
import { aiMode, searchConfig } from "../../../lib/providers/config";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "올바른 JSON 요청이 필요합니다." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || !("query" in body) || !validQuery(body.query)) {
    return Response.json({ error: "조사할 내용을 2~300자로 입력해 주세요." }, { status: 400 });
  }
  const result = await research(body.query, {
    mode: aiMode(process.env),
    config: searchConfig(process.env),
  });
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
