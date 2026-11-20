import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { parseEnv } from "node:util";
import next from "next";
import { createLinerRecorder, linerEndpoint } from "./liner-recording";

const hostname = "127.0.0.1";
const mode = process.argv[2];
const port = Number(process.argv[3]);

function keyForCapture(inheritedKey: string | undefined) {
  if (inheritedKey) return inheritedKey;
  const root = process.cwd();
  const worktrees = dirname(root);
  const paths = basename(worktrees) === ".worktrees"
    ? [resolve(root, ".env.local"), resolve(worktrees, "..", ".env.local")] : [resolve(root, ".env.local")];
  for (const path of paths) {
    if (!existsSync(path)) continue;
    const candidate = parseEnv(readFileSync(path, "utf8")).LINER_API_KEY?.trim();
    if (candidate) return candidate;
  }
}

async function start() {
  if ((mode !== "saved" && mode !== "public" && mode !== "liner") || !Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error("Invalid E2E mode or port.");
  }

  const inheritedKey = mode === "liner" ? process.env.LINER_API_KEY?.trim() : undefined;
  // Explicit empty values prevent Next.js from refilling secrets from dotenv.
  process.env.MAIL_FROM = "";
  process.env.GMAIL_APP_PASSWORD = "";
  process.env.TEST_MAIL_TO = "";
  process.env.VERCEL = "";
  process.env.NEXT_TELEMETRY_DISABLED = "1";
  process.env.LINER_MODE = mode === "liner" ? "live" : "sample";
  process.env.LINER_API_KEY = mode === "liner" ? "e2e-recorder-only" : "";
  process.env.MIRINAE_DEMO_TARGET = mode === "public" ? "public" : "local";
  process.env.MIRINAE_E2E_SERVER = mode;
  const configDir = resolve(".cache", "e2e-" + mode);
  mkdirSync(configDir, { recursive: true });
  const tsconfig = resolve(configDir, "tsconfig.json");
  if (!existsSync(tsconfig)) writeFileSync(tsconfig, JSON.stringify({ extends: "../../tsconfig.json" }) + "\n");

  const originalFetch = globalThis.fetch;
  const recorder = mode === "liner" ? createLinerRecorder(originalFetch, () => keyForCapture(inheritedKey)) : null;
  globalThis.fetch = (input, init) => {
    const destination = new URL(input instanceof Request ? input.url : input);
    if (destination.href === linerEndpoint && recorder) return recorder.fetch(input, init);
    if (destination.hostname === hostname || destination.hostname === "localhost") return originalFetch(input, init);
    return Promise.reject(new Error("Unrecorded external fetch blocked by the E2E server."));
  };

  const app = next({ dev: true, hostname, port });
  const handler = app.getRequestHandler();
  await app.prepare();
  createServer((request, response) => {
    const path = new URL(request.url ?? "/", "http://" + hostname + ":" + port).pathname;
    if (path === "/__e2e/health" || path === "/__e2e/liner") {
      response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      response.end(JSON.stringify(path === "/__e2e/health" ? { mode } : recorder?.counters
        ?? { live: 0, replayed: 0, blocked: 0, recorded: 0 }));
      return;
    }
    if (path === "/api/forwarding/mail" && mode !== "public") {
      // Browser tests fulfill permitted writes in memory; a missed mock must never reach SMTP.
      response.writeHead(403, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      response.end(JSON.stringify({ code: "e2e-mail-blocked", message: "테스트 서버에서 실제 메일을 차단했습니다." }));
      return;
    }
    void handler(request, response);
  }).listen(port, hostname);
}

start().catch(() => {
  console.error("The E2E app could not start.");
  process.exitCode = 1;
});
