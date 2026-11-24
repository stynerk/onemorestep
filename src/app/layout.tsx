import type { Metadata } from "next";
import { isPublicDemo, linerRuntimeSettings } from "../lib/demo-mode";
import { demoIndustries } from "../lib/forwarding/industry-demo.server";
import { AppWorkspace } from "./app-workspace";
import { DemoSessionGate } from "./demo-session";
import "./globals.css";
import "./demo-session.css";

// The shared workspace keeps the deployment runtime's settings from login onward.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "One More Step",
  description: "세일즈보다 한발 앞에서 리드를 선별하고 넘길 곳을 준비합니다.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const publicDemo = isPublicDemo();
  const liner = linerRuntimeSettings();
  const liveAssessment = liner.mode?.trim() === "live" && Boolean(liner.apiKey?.trim());
  return <html lang="ko"><body><DemoSessionGate>
    <AppWorkspace publicDemo={publicDemo} liveAssessment={liveAssessment} industries={publicDemo ? demoIndustries : []}>
      {children}
    </AppWorkspace>
  </DemoSessionGate></body></html>;
}
