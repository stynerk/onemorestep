import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";

const environmentFiles = [".env", ".env.local", ".env.production", ".env.production.local"];
const privateSettings = ["LINER_API_KEY", "MAIL_FROM", "GMAIL_APP_PASSWORD", "TEST_MAIL_TO"];
if (environmentFiles.some((file) => existsSync(file))
  || privateSettings.some((key) => process.env[key]?.trim())) {
  console.error("Public demo build requires a clean worktree and no private service settings.");
  process.exitCode = 1;
} else {
  const require = createRequire(import.meta.url);
  const next = require.resolve("next/dist/bin/next");
  const result = spawnSync(process.execPath, [next, "build"], {
    env: { ...process.env, MIRINAE_PUBLIC_BUILD: "1" },
    stdio: "inherit",
  });
  if (result.error) console.error("Could not start the public demo build.");
  process.exitCode = result.status ?? 1;
}
