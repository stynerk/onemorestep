import { normalizeSources, record, type ProviderConfig, type SearchProvider, type Transport } from "./contracts";
import { endpoint, postJson } from "./http";

// Add another vendor adapter here; callers and public Source fields stay unchanged.
export function createSearchProvider(config: ProviderConfig, transport: Transport = {}): SearchProvider {
  switch (config.provider) {
    case "liner":
      return { async search(query) {
        const body = record(await postJson("https://platform.liner.com/api/v1/tools/search/web", config.apiKey, "x-api-key",
          { query, lang: "ko", country_code: "kr", max_results: 3, include_knowledge: false }, transport));
        return normalizeSources(body.results);
      } };
    case "http-json": {
      const url = endpoint(config.endpoint);
      return { async search(query) {
        const body = record(await postJson(url, config.apiKey, "bearer", { query, maxResults: 3, locale: "ko-KR" }, transport));
        return normalizeSources(body.sources);
      } };
    }
    default: throw new Error("Unsupported search provider");
  }
}
