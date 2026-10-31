import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import AuthButton from "@/components/AuthButton";
import Providers from "@/components/Providers";
import SiteFooter from "@/components/SiteFooter";

import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL;
const description =
  "เรียนเขียนโค้ดฟรี Python, JavaScript, HTML & CSS เนื้อหาอ่านง่าย มีตัวอย่างสาธิตและวาดภาพด้วยโค้ด รันในเบราว์เซอร์ได้เลย พร้อมแบบฝึกหัดและ AI ช่วยตอบ";

export const metadata: Metadata = {
  ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
  title: { default: "AI Code Learn — เรียนเขียนโค้ดฟรี", template: "%s · AI Code Learn" },
  description,
  openGraph: {
    type: "website",
    locale: "th_TH",
    siteName: "AI Code Learn",
    title: "AI Code Learn — เรียนเขียนโค้ดฟรี",
    description,
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="th">
      <body>
        <Providers>
          <header className="site-header">
            <div className="site-header-inner">
              <Link href="/" className="brand">
                AI Code Learn
              </Link>
              <nav className="nav">
                <Link href="/lessons">บทเรียน</Link>
                <Link href="/playground">Playground</Link>
                <Link href="/dashboard">Dashboard</Link>
              </nav>
              <div className="spacer" />
              <AuthButton />
            </div>
          </header>
          {children}
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
