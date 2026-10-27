"use client";

import { signIn, signOut, useSession } from "next-auth/react";

export default function AuthButton() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <span className="muted small">กำลังโหลด…</span>;
  }

  if (!session) {
    return (
      <button className="btn btn-primary" onClick={() => void signIn("github")}>
        เข้าสู่ระบบด้วย GitHub
      </button>
    );
  }

  return (
    <div className="auth">
      <span className="small">{session.user?.name ?? session.user?.email ?? "ผู้ใช้"}</span>
      <button className="btn btn-ghost" onClick={() => void signOut()}>
        ออกจากระบบ
      </button>
    </div>
  );
}
