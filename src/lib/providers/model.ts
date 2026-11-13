import { record, type ModelProvider, type ProviderConfig, type Transport } from "./contracts";
import { endpoint, postJson } from "./http";

// This adapter requires a Chat Completions endpoint with JSON-schema output support.
export function createModelProvider(config: ProviderConfig, transport: Transport = {}): ModelProvider {
  if (!["liner", "chat-completions"].includes(config.provider)) throw new Error("Unsupported model provider");
  const liner = config.provider === "liner";
  const url = liner ? "https://platform.liner.com/api/v1/chat/completions" : endpoint(config.endpoint);
  const model = config.model ?? (liner ? "liner-claude-router" : undefined);
  if (!model?.trim()) throw new Error("Model required");
  return { async generate(request) {
    const body = record(await postJson(url, config.apiKey, "bearer", {
      model, stream: false, max_completion_tokens: 2000,
      ...(liner ? { routing_strategy: "balanced" } : {}),
      messages: [{ role: "system", content: request.system }, { role: "user", content: request.user }],
      response_format: { type: "json_schema", json_schema: { name: "workflow_proposal", strict: true, schema: request.schema } },
    }, transport));
    if (!Array.isArray(body.choices) || !body.choices.length) throw new Error("Invalid completion");
    const choice = record(body.choices[0]);
    if (choice.finish_reason !== "stop") throw new Error("Incomplete completion");
    const content = record(choice.message).content;
    if (typeof content !== "string" || content.length > 32000) throw new Error("Invalid model content");
    return JSON.parse(content);
  } };
}
