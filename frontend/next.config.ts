import type { NextConfig } from "next";

/**
 * โค้ดของผู้เรียนรันใน Web Worker ที่อยู่ origin เดียวกับเว็บ ถ้าไม่จำกัด โค้ดที่ผู้เรียนเผลอวางมาจากคนอื่น
 * อาจ fetch("/api/auth/session") เพื่ออ่านโทเคนล็อกอินของผู้ใช้ไปได้
 *
 * CSP ที่แนบมากับไฟล์ worker มีผลกับตัว worker เอง: connect-src 'none' ปิด fetch / XHR / WebSocket ทั้งหมด,
 * default-src 'none' ปิดการโหลดสคริปต์/worker ซ้อนอื่น ๆ ส่วน 'unsafe-eval' จำเป็นเพราะตัวรันต้องแปลงโค้ดผู้เรียนเป็นฟังก์ชัน
 * (ผลของ CSP นี้ทดสอบกับ Chromium จริงแล้ว — อย่าแก้โดยไม่ทดสอบ)
 *
 * หมายเหตุ: worker ของ Python ยังไม่ได้ใส่ CSP เพราะ Pyodide ต้องดาวน์โหลดไฟล์จาก CDN ซึ่งยังทดสอบกับเบราว์เซอร์จริงไม่ได้
 */
const JS_WORKER_CSP = "default-src 'none'; script-src 'unsafe-eval'; connect-src 'none'";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/workers/js-worker.js",
        headers: [
          { key: "Content-Security-Policy", value: JS_WORKER_CSP },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
