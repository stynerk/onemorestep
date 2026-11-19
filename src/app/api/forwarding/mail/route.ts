import { dispatchForwardingMail } from "../../../../lib/forwarding/forwarding-mail.server";
import { mailKindFor } from "../../../../lib/forwarding/inbox";
import { forwardingPolicy } from "../../../../lib/forwarding/policy";
import { createInitialForwardingState } from "../../../../lib/forwarding/seed";
import { isForwardingEvent } from "../../../../lib/forwarding/store";

export const runtime = "nodejs";

const demo = createInitialForwardingState();
const headers = { "Cache-Control": "no-store" };
const invalid = () => Response.json({ message: "시연 업무 기록을 확인할 수 없습니다." }, { status: 400, headers });

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  const incomingHost = request.headers.get("host") ?? url.host;
  // Next may canonicalize the URL hostname, while Chrome uses the address entered in its URL bar.
  const expectedOrigin = url.protocol + "//" + incomingHost;
  if (origin !== expectedOrigin || request.headers.get("sec-fetch-site") === "cross-site") {
    return Response.json({ message: "같은 화면에서만 메일을 요청할 수 있습니다." }, { status: 403, headers });
  }
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return invalid();
  let input: unknown;
  try {
    const body = await request.text();
    if (body.length > 48000) return invalid();
    input = JSON.parse(body);
  } catch {
    return invalid();
  }
  if (!input || typeof input !== "object" || Array.isArray(input) || !("event" in input)
    || Object.keys(input).some((key) => key !== "event" && key !== "retryOf")
    || ("retryOf" in input && (typeof input.retryOf !== "string" || !/^mail:[a-f0-9]{64}:\d+$/.test(input.retryOf)))
    || !isForwardingEvent(input.event, demo)) return invalid();

  const event = input.event;
  const lead = demo.leads.find((row) => row.id === event.leadId);
  if (!lead) return invalid();
  if (event.type === "decision" && !demo.dealers.some((dealer) =>
    dealer.id === event.dealerId && dealer.active && dealer.products.includes(lead.product))) return invalid();
  const kind = event.type === "assessed" && !Object.hasOwn(forwardingPolicy.countryRegions, lead.country)
    ? "operations" : mailKindFor(event);
  if (!kind) return invalid();
  const retryOf = "retryOf" in input && typeof input.retryOf === "string" ? input.retryOf : undefined;
  const result = await dispatchForwardingMail({ eventId: event.id, leadId: event.leadId, kind, retryOf });
  return Response.json(result, { status: result.event ? 200 : 409, headers });
}
