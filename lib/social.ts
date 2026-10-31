export const normalizeUsername = (value: string) => value.trim().replace(/^@/, "").toLowerCase();
export const isUsername = (value: string) => /^[a-z0-9_]{3,24}$/.test(value)
  && !new Set(["admin", "administrator", "support", "system", "cleartoh"]).has(value);
export function userPair(a: number, b: number) {
  return { lowUserId: Math.min(a, b), highUserId: Math.max(a, b) };
}
export type AccountPerson = { id: number; name: string; username: string; image: string | null; hasPromptPay: boolean; ownerAlias?: string | null };
export type PersonResult = AccountPerson & { relationship: "NONE" | "FRIEND" | "PENDING_SENT" | "PENDING_RECEIVED" };
export type SavedGroup = { id: string; name: string; members: AccountPerson[] };
export function safeAccountReturn(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || /[\\\p{Cc}]/u.test(value)) return "/bills";
  const url = new URL(value, "https://clear-toh.invalid");
  return url.pathname === "/onboarding" ? "/bills" : url.pathname + url.search + url.hash;
}
