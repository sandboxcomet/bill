import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Line from "next-auth/providers/line";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  debug: false,
  trustHost: true,
  cookies: {
    sessionToken: {
      name: process.env.AUTH_URL?.startsWith("https://")
        ? "__Secure-wonglao-bill.session-token"
        : "wonglao-bill.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.AUTH_URL?.startsWith("https://") ?? false,
      },
    },
  },
  adapter: (() => {
    const pAdapter = PrismaAdapter(prisma);
    return {
      ...pAdapter,
      updateUser: ({ id, ...data }) =>
        pAdapter.updateUser!({ ...data, id: Number(id) as any }),
      getUser: (id) => pAdapter.getUser!(Number(id) as any),
      linkAccount: (account) =>
        pAdapter.linkAccount!({
          ...account,
          userId: Number(account.userId) as any,
        }),
    };
  })(),
  providers: [
    ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
      ? [Google]
      : []),
    ...(process.env.AUTH_LINE_ID && process.env.AUTH_LINE_SECRET
      ? [Line({ allowDangerousEmailAccountLinking: false })]
      : []),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) token.id = String(user.id);
      if (account?.provider === "google" || account?.provider === "line")
        token.loginProvider = account.provider;
      const userId = Number(token.id);
      if (Number.isSafeInteger(userId) && userId > 0) {
        // Read the stored nickname; never accept a client-supplied display name.
        const profile = await prisma.user.findUnique({
          where: { id: userId },
          select: { nickname: true, username: true, accounts: { select: { provider: true } } },
        });
        token.nickname = profile?.nickname ?? null;
        token.username = profile?.username ?? null;
        // Older sessions did not store the provider. Only infer it when the
        // account has one linked identity; never guess between providers.
        if (!token.loginProvider && profile?.accounts.length === 1) {
          const provider = profile.accounts[0].provider;
          if (provider === "google" || provider === "line") token.loginProvider = provider;
        }
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = String(token.id);
        session.user.username = typeof token.username === "string" ? token.username : null;
        session.user.loginProvider = token.loginProvider === "google" || token.loginProvider === "line" ? token.loginProvider : null;
        session.user.nickname =
          typeof token.nickname === "string" ? token.nickname : null;
      }
      return session;
    },
  },
});
