"use client";

import { useEffect, useState } from "react";

import { buildPreviewDoc, PREVIEW_SANDBOX } from "@/lib/htmlcheck";

/** ตัวอย่างผลลัพธ์ของ HTML/CSS แบบสด (อัปเดตหลังหยุดพิมพ์สั้น ๆ) — iframe แยกที่ไม่รันสคริปต์ */
export default function HtmlPreview({ code }: { code: string }) {
  const [doc, setDoc] = useState(() => buildPreviewDoc(code));

  useEffect(() => {
    const timer = setTimeout(() => setDoc(buildPreviewDoc(code)), 300);
    return () => clearTimeout(timer);
  }, [code]);

  return <iframe className="html-preview" title="ตัวอย่างผลลัพธ์ของหน้าเว็บ" sandbox={PREVIEW_SANDBOX} srcDoc={doc} />;
}
