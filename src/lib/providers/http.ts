import type { Transport } from "./contracts";

export function endpoint(value: string | undefined): string {
  if (!value) throw new Error("Endpoint required");
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.hash) throw new Error("Invalid endpoint");
  return url.href;
}

export async function postJson(url: string, apiKey: string | undefined, auth: "x-api-key" | "bearer", body: unknown, transport: Transport): Promise<unknown> {
  if (!apiKey?.trim()) throw new Error("Key required");
  const response = await (transport.fetcher ?? fetch)(endpoint(url), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(auth === "bearer" ? { Authorization: `Bearer ${apiKey}` } : { "x-api-key": apiKey }) },
    body: JSON.stringify(body), signal: AbortSignal.timeout(transport.timeoutMs ?? 8000),
    redirect: "error", cache: "no-store",
  });
  if (!response.ok) throw new Error("Upstream failed");
  return response.json();
}
