import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Line from "next-auth/providers/line";
import Credentials from "next-auth/providers/credentials";
import { CredentialsSignin } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { sessionCookieName } from "@/lib/server/auth-session";
import { captureConnection } from "@/lib/server/account-connections";
import { authenticatePasskey, PasskeyError } from "@/lib/server/passkeys";
import { PaymentError } from "@/lib/payment-contract";

class PasskeySigninError extends CredentialsSignin {
  code = "passkey_failed";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  debug: false,
  trustHost: true,
  cookies: {
    sessionToken: {
      name: sessionCookieName(),
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
      getUser: async (id) => {
        const user = await prisma.user.findUnique({ where: { id: Number(id) } });
        return user && !user.mergedIntoId ? user as any : null;
      },
      linkAccount: (account) =>
        pAdapter.linkAccount!({
          ...account,
          userId: Number(account.userId) as any,
        }),
    };
  })(),
  providers: [
    Credentials({
      id: "passkey", name: "Passkey", credentials: { response: { type: "text" } },
      async authorize(credentials, request) {
        try { return await authenticatePasskey(credentials.response, request); }
        catch (error) {
          if (!(error instanceof PasskeyError) && !(error instanceof PaymentError)) {
            console.error("[passkey] Sign-in failed", error instanceof Error ? error.name : "unknown");
          }
          throw new PasskeySigninError();
        }
      },
    }),
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
    async signIn({ account, user }) {
      return captureConnection(account ?? null, user);
    },
    async jwt({ token, user, account }) {
      if (user) token.id = String(user.id);
      if (account?.provider === "google" || account?.provider === "line" || account?.provider === "passkey")
        token.loginProvider = account.provider;
      if (user && account) token.passkeyId = account.provider === "passkey" ? user.passkeyId : undefined;
      const userId = Number(token.id);
      if (Number.isSafeInteger(userId) && userId > 0) {
        // Read the stored nickname; never accept a client-supplied display name.
        const profile = await prisma.user.findUnique({
          where: { id: userId },
          select: { nickname: true, username: true, authVersion: true, mergedIntoId: true, accounts: { select: { provider: true } } },
        });
        if (!profile || profile.mergedIntoId) return null;
        if (account?.provider === "passkey" && user?.passkeyAuthVersion !== profile.authVersion) return null;
        if (token.loginProvider === "passkey" && typeof token.passkeyId !== "string") return null;
        if (typeof token.passkeyId === "string") {
          const key = await prisma.passkey.findUnique({ where: { id: token.passkeyId },
            select: { revokedAt: true, user: { select: { id: true, mergedIntoId: true } } } });
          if (!key || key.revokedAt || (key.user.mergedIntoId || key.user.id) !== userId) return null;
        }
        if (user && account) {
          token.authVersion = profile.authVersion;
          token.authenticatedAt = Date.now();
        }
        if ((token.authVersion ?? 0) !== profile.authVersion) return null;
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
        session.user.loginProvider = token.loginProvider === "google" || token.loginProvider === "line" || token.loginProvider === "passkey" ? token.loginProvider : null;
        session.user.nickname =
          typeof token.nickname === "string" ? token.nickname : null;
      }
      return session;
    },
  },
});
