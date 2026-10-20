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
    jwt({ token, user }) {
      if (user) token.id = String(user.id);
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) session.user.id = String(token.id);
      return session;
    },
  },
});
