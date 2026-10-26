import { billIdFromPagePath, legacyBillRedirect, sharedBillPath } from "./bill-paths";
import { stripLocale } from "./locale";

export const isInstagramBrowser = (userAgent: string) => /\bInstagram\b/i.test(userAgent);

// Reopen the receipt to obtain fresh PIN/payment access in the new browser.
// Session storage, OAuth codes and participant tokens must not be transferred.
export function browserHandoffUrl(href: string): string | null {
  try {
    const current = new URL(href);
    if (!["https:", "http:"].includes(current.protocol) || current.username || current.password) return null;
    let target = current;
    for (let depth = 0; depth < 4; depth++) {
      const path = stripLocale(target.pathname);
      if (path !== "/login" && path !== "/onboarding") break;
      const callback = target.searchParams.get("callbackUrl");
      if (!callback || !callback.startsWith("/") || callback.startsWith("//") || /[\\\p{Cc}]/u.test(callback)) {
        target = new URL("/login", current.origin);
        break;
      }
      target = new URL(callback, current.origin);
    }
    const path = stripLocale(target.pathname);
    const canonical = legacyBillRedirect(path) ?? path;
    const billId = billIdFromPagePath(canonical);
    if (billId) return new URL(sharedBillPath(billId), current.origin).href;
    if (/^\/api(?:\/|$)/.test(canonical) || canonical === "/login" || canonical === "/onboarding") {
      return new URL("/login", current.origin).href;
    }
    target.hash = "";
    for (const key of [...target.searchParams.keys()]) {
      if (/^(?:code|state|id_token|access_token|token|paymentToken|payment_token|pin|passcode)$/i.test(key)) {
        target.searchParams.delete(key);
      }
    }
    return target.href;
  } catch { return null; }
}
