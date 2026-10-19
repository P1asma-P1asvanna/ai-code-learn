import type { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";

const API = process.env.NEXT_PUBLIC_API_URL!;

export const authOptions: NextAuthOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      // ทำครั้งเดียวตอน sign in: แลก GitHub profile เป็น JWT ของ backend เรา
      if (account && profile) {
        const res = await fetch(`${API}/api/v1/auth/github`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Internal-Secret": process.env.INTERNAL_API_SECRET!,
          },
          body: JSON.stringify({
            github_id: String((profile as { id: number }).id),
            username: (profile as { login: string }).login,
            email: token.email ?? null,
            avatar_url: token.picture ?? null,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          token.accessToken = data.access_token;
          token.userId = data.user_id;
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string | undefined;
      session.userId = token.userId as string | undefined;
      return session;
    },
  },
};
