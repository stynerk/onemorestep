import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const result = spawnSync(process.execPath, [require.resolve("@playwright/test/cli"), "test", ...process.argv.slice(2)], {
  env: { ...process.env, MIRINAE_E2E_LINER: "1" },
  stdio: "inherit",
});
process.exitCode = result.status ?? 1;
