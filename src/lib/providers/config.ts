import type { ProviderConfig } from "./contracts";

type Environment = Record<string, string | undefined>;

export function searchConfig(env: Environment): ProviderConfig {
  const provider = env.SEARCH_PROVIDER ?? "liner";
  return provider === "liner"
    ? { provider, apiKey: env.LINER_API_KEY }
    : { provider, apiKey: env.SEARCH_API_KEY, endpoint: env.SEARCH_API_URL };
}

export function modelConfig(env: Environment): ProviderConfig {
  const provider = env.PLANNER_PROVIDER ?? "liner";
  return provider === "liner"
    ? { provider, apiKey: env.LINER_API_KEY, model: env.PLANNER_MODEL ?? "liner-claude-router" }
    : { provider, apiKey: env.PLANNER_API_KEY, endpoint: env.PLANNER_API_URL, model: env.PLANNER_MODEL };
}

export function aiMode(env: Environment): string | undefined {
  return env.AI_MODE ?? env.LINER_MODE;
}
