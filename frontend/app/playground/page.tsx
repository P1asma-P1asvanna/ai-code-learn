import type { Metadata } from "next";

import Playground from "@/components/Playground";

export const metadata: Metadata = {
  title: "Playground · AI Code Learn",
};

export default function PlaygroundPage() {
  return (
    <main className="container">
      <h1>Playground</h1>
      <p className="muted">เขียนโค้ดแล้วรันได้ทันทีในเบราว์เซอร์ ไม่ต้องติดตั้งอะไร</p>
      <Playground />
    </main>
  );
}
