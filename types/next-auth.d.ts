import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      nickname: string | null;
      username: string | null;
      loginProvider: "google" | "line" | null;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    authVersion?: number;
    authenticatedAt?: number;
    nickname?: string | null;
    username?: string | null;
    loginProvider?: "google" | "line" | null;
  }
}
