import "next-auth";

declare module "next-auth" {
  interface Session {
    /** JWT สำหรับเรียก backend (หมดอายุแล้วจะถูกต่ออายุอัตโนมัติ) */
    accessToken?: string;
  }
}
