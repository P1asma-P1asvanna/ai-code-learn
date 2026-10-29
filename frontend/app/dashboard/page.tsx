import type { Metadata } from "next";

import DashboardView from "@/components/DashboardView";

export const metadata: Metadata = {
  title: "Dashboard · AI Code Learn",
};

export default function DashboardPage() {
  return (
    <main className="container narrow">
      <h1>Dashboard</h1>
      <p className="muted">คะแนน ความคืบหน้า และบทเรียนที่เรียนไปแล้วของคุณ</p>
      <DashboardView />
    </main>
  );
}
