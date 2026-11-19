import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  agentRules: false,
  env: {
    // Only this literal deployment mode is compiled into the app.
    MIRINAE_DEMO_TARGET: process.env.MIRINAE_DEMO_TARGET === "public" || process.env.VERCEL === "1" ? "public" : "local",
  },
};

export default config;
