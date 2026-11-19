import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

const e2eModes = ["saved", "public", "liner"];
const config = (phase: string): NextConfig => {
  const mode = phase === PHASE_DEVELOPMENT_SERVER
    ? e2eModes.find((candidate) => candidate === process.env.MIRINAE_E2E_SERVER) : undefined;
  return {
    poweredByHeader: false,
    agentRules: false,
    env: {
      // Only this literal deployment mode is compiled into the app.
      MIRINAE_DEMO_TARGET: process.env.MIRINAE_DEMO_TARGET === "public" || process.env.VERCEL === "1" ? "public" : "local",
    },
    // E2E runs the saved, public and recorder servers without sharing a dev lock.
    ...(mode ? { distDir: ".cache/e2e-" + mode + "/next", typescript: { tsconfigPath: ".cache/e2e-" + mode + "/tsconfig.json" } } : {}),
  };
};

export default config;
