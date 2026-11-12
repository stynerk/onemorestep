import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "미리내 · 개발 준비",
  description: "미리내 Liner 조사 기능의 개발 세팅 확인 화면",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
