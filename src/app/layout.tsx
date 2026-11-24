import type { Metadata } from "next";
import { DemoSessionGate } from "./demo-session";
import "./globals.css";
import "./demo-session.css";

export const metadata: Metadata = {
  title: "One More Step",
  description: "세일즈보다 한발 앞에서 리드를 선별하고 넘길 곳을 준비합니다.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body><DemoSessionGate>{children}</DemoSessionGate></body></html>;
}
