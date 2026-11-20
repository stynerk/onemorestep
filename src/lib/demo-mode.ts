export function isPublicDemo() {
  return process.env.MIRINAE_DEMO_TARGET === "public" || process.env.VERCEL === "1";
}

export function linerRuntimeSettings() {
  if (isPublicDemo()) return { mode: "sample" };
  return { mode: process.env.LINER_MODE, apiKey: process.env.LINER_API_KEY };
}
