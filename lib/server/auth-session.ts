import { decode } from "next-auth/jwt";

export function sessionCookieName() {
  return process.env.AUTH_URL?.startsWith("https://")
    ? "__Secure-wonglao-bill.session-token" : "wonglao-bill.session-token";
}

export async function readSessionIdentity(cookies: { getAll(): { name: string; value: string }[] }) {
  const name = sessionCookieName();
  const parts = cookies.getAll().filter(cookie => cookie.name === name || cookie.name.startsWith(`${name}.`))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const token = parts.map(cookie => cookie.value).join("");
  const secret = process.env.AUTH_SECRET;
  if (!token || !secret) return null;
  try {
    const claims = await decode({ token, secret, salt: name });
    const id = Number(claims?.id);
    if (!Number.isSafeInteger(id) || id <= 0) return null;
    return { id, version: Number(claims?.authVersion ?? 0), authenticatedAt: Number(claims?.authenticatedAt ?? 0) };
  } catch { return null; }
}
