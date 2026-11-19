import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "미리내 · 문의함",
  description: "공개 기관 정보로 문의를 판정하고 딜러 결정을 돕는 미리내 문의함",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
