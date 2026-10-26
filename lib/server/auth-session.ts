import { decode } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";

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
    if (claims?.loginProvider === "passkey" && typeof claims.passkeyId !== "string") return null;
    if (typeof claims?.passkeyId === "string") {
      const key = await prisma.passkey.findUnique({ where: { id: claims.passkeyId },
        select: { revokedAt: true, user: { select: { id: true, mergedIntoId: true } } } });
      if (!key || key.revokedAt || (key.user.mergedIntoId || key.user.id) !== id) return null;
    }
    return { id, version: Number(claims?.authVersion ?? 0), authenticatedAt: Number(claims?.authenticatedAt ?? 0) };
  } catch { return null; }
}
