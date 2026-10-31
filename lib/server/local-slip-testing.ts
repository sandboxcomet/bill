// Never relax duplicate/date checks for deployed or remote-database environments.
export function allowLocalSlipReuse(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.NODE_ENV !== "development" || !env.DATABASE_URL || !(env.AUTH_URL || env.NEXTAUTH_URL)) return false;
  try {
    const loopback = ["localhost", "127.0.0.1", "[::1]", "::1"];
    return loopback.includes(new URL(env.DATABASE_URL).hostname) &&
      loopback.includes(new URL(env.AUTH_URL || env.NEXTAUTH_URL!).hostname);
  } catch {
    return false;
  }
}
