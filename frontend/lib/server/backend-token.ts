import { createHmac } from "node:crypto";

/**
 * เซ็น JWT (HS256) สำหรับเรียก backend — ใช้ได้เฉพาะฝั่ง server เท่านั้น
 * backend ตรวจลายเซ็นด้วย JWT_SECRET ตัวเดียวกัน จึงไม่ต้องเรียก backend ตอนล็อกอิน
 * (Render free tier หลับอยู่ ถ้าต้องรอปลุกตอนล็อกอินจะ timeout)
 */

export type BackendClaims = {
  /** GitHub user id */
  sub: string;
  login: string;
  picture?: string | null;
};

const base64url = (input: string) => Buffer.from(input).toString("base64url");

export function signBackendToken(
  claims: BackendClaims,
  ttlSeconds = 7 * 24 * 60 * 60,
  now: number = Math.floor(Date.now() / 1000),
): { token: string; exp: number } {
  const secret = process.env.BACKEND_JWT_SECRET;
  if (!secret) {
    throw new Error("BACKEND_JWT_SECRET is not set");
  }
  const exp = now + ttlSeconds;
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({ ...claims, iat: now, exp }));
  const signature = createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return { token: `${header}.${payload}.${signature}`, exp };
}
