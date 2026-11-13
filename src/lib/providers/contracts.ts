export type Source = { title: string; url: string; description: string };

export interface SearchProvider {
  search(query: string): Promise<Source[]>;
}

export type GenerationRequest = { system: string; user: string; schema: Record<string, unknown> };
export interface ModelProvider {
  generate(request: GenerationRequest): Promise<unknown>;
}

export type ProviderConfig = { provider: string; apiKey?: string; endpoint?: string; model?: string };
export type Transport = { fetcher?: typeof fetch; timeoutMs?: number };

export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid object");
  return value as Record<string, unknown>;
}

export function safeUrl(value: unknown): string {
  if (typeof value !== "string" || value.length > 2000) throw new Error("Invalid URL");
  const url = new URL(value);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw new Error("Unsafe URL");
  return url.href;
}

export function normalizeSources(value: unknown): Source[] {
  if (!Array.isArray(value)) throw new Error("Invalid sources");
  return value.slice(0, 3).map(item => {
    const source = record(item);
    if (typeof source.title !== "string" || typeof source.description !== "string") throw new Error("Invalid source");
    return { title: source.title.slice(0, 300), url: safeUrl(source.url), description: source.description.slice(0, 2000) };
  });
}
