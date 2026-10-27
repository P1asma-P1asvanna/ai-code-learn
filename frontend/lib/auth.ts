import type { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";

import { signBackendToken } from "@/lib/server/backend-token";

const SESSION_SECONDS = 7 * 24 * 60 * 60;
const RENEW_BEFORE_SECONDS = 24 * 60 * 60;

export const authOptions: NextAuthOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_ID ?? "",
      clientSecret: process.env.GITHUB_SECRET ?? "",
    }),
  ],
  session: { strategy: "jwt", maxAge: SESSION_SECONDS },
  callbacks: {
    async jwt({ token, account, profile }) {
      // ตอนล็อกอินครั้งแรก จำตัวตน GitHub ไว้ใน token ของ Auth.js
      if (account && profile) {
        const github = profile as { id?: number | string; login?: string };
        token.githubId = String(github.id ?? token.sub ?? "");
        token.login = github.login ?? token.name ?? "user";
      }

      // ออก/ต่ออายุ token สำหรับ backend เมื่อยังไม่มีหรือใกล้หมดอายุ (ไม่ต้องเรียก backend)
      const now = Math.floor(Date.now() / 1000);
      const expiresAt = typeof token.backendTokenExp === "number" ? token.backendTokenExp : 0;
      if (
        typeof token.githubId === "string" &&
        token.githubId !== "" &&
        (typeof token.backendToken !== "string" || expiresAt - now < RENEW_BEFORE_SECONDS)
      ) {
        const signed = signBackendToken({
          sub: token.githubId,
          login: String(token.login ?? "user"),
          picture: typeof token.picture === "string" ? token.picture : null,
        });
        token.backendToken = signed.token;
        token.backendTokenExp = signed.exp;
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken =
        typeof token.backendToken === "string" ? token.backendToken : undefined;
      return session;
    },
  },
};
