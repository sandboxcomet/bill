import { stripLocale } from "./locale";

// Payment links must survive sign-in (including an intervening onboarding step).
export function loginDestination(callback: unknown): string {
  return resolveDestination(callback, true);
}

function resolveDestination(callback: unknown, allowOnboarding: boolean): string {
  if (typeof callback !== "string" || !callback.startsWith("/") || callback.startsWith("//") || /[\\\p{Cc}]/u.test(callback)) return "/dashboard";
  const url = new URL(callback, "https://clear-toh.invalid");
  const path = stripLocale(url.pathname);
  if (allowOnboarding && path === "/onboarding") {
    const nested = url.searchParams.get("callbackUrl");
    if (nested) return resolveDestination(nested, false);
    return "/dashboard";
  }
  if (path === "/demo") return "/demo";
  return /^\/c[a-z0-9]{24}\/[^/]+\/?$/.test(path)
    ? path + url.search + url.hash
    : "/dashboard";
}
