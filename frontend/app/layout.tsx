import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import AuthButton from "@/components/AuthButton";
import Providers from "@/components/Providers";

import "./globals.css";

export const metadata: Metadata = {
  title: "AI Code Learn",
  description: "เรียนเขียนโค้ดฟรี พร้อม Playground และ AI ช่วยตรวจโค้ด",
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
              </nav>
              <div className="spacer" />
              <AuthButton />
            </div>
          </header>
          {children}
        </Providers>
      </body>
    </html>
  );
}
