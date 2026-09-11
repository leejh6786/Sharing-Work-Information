import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "해남제일중 업무 공유",
  description: "해남제일중학교 교직원 업무 일정 공유",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
