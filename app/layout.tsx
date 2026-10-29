import type { Metadata } from "next";
import "@fontsource/noto-sans-sc/400.css";
import "@fontsource/noto-sans-sc/500.css";
import "@fontsource/noto-sans-sc/600.css";
import "@fontsource/noto-sans-sc/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "衡迹 ESG｜ESG 披露管理平台",
  description: "面向企业的 ESG 报告编制与披露协同工作台",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
