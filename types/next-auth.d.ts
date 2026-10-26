import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    passkeyId?: string;
    passkeyAuthVersion?: number;
  }
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      nickname: string | null;
      username: string | null;
      loginProvider: "google" | "line" | "passkey" | null;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    authVersion?: number;
    authenticatedAt?: number;
    nickname?: string | null;
    username?: string | null;
    loginProvider?: "google" | "line" | "passkey" | null;
    passkeyId?: string;
  }
}
