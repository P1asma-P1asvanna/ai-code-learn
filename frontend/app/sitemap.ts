import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL;

// หน้าหลัก ๆ ที่ให้เครื่องมือค้นหารู้จัก (ไม่ใส่หน้าที่ต้องล็อกอิน) ถ้าไม่ได้ตั้งค่าที่อยู่เว็บ จะไม่ส่งอะไร
export default function sitemap(): MetadataRoute.Sitemap {
  if (!siteUrl) return [];
  const base = siteUrl.replace(/\/$/, "");
  return ["", "/lessons", "/playground", "/about"].map((path) => ({ url: `${base}${path}` }));
}
