import { prisma } from "@/lib/prisma";
import { isUsername } from "@/lib/social";

type Profile = {
  id: string;
  name?: string | null;
  username: string | null;
  nickname: string | null;
  loginProvider: "google" | "line" | null;
};

// Suggestions are editable form defaults, never an automatic profile update.
export async function onboardingProfile(user: Profile) {
  const defaults = { nickname: user.nickname ?? "", suggestedUsername: "" };
  if (user.loginProvider !== "line") return defaults;
  const name = (user.name ?? "").replace(/\p{Cc}/gu, " ").trim();
  if (!defaults.nickname) defaults.nickname = name.slice(0, 40).replace(/[\uD800-\uDBFF]$/u, "").trim();
  if (user.username) return defaults;

  // LINE supplies a display name, not the user's chosen LINE ID.
  const normalized = name.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24);
  const base = isUsername(normalized) ? normalized : "line_user";
  const suffixes = ["", `_${user.id}`, `_${user.id}_2`, `_${user.id}_3`];
  const candidates = [...new Set(suffixes.map(suffix => `${base.slice(0, 24 - suffix.length)}${suffix}`).filter(isUsername))];
  const existing = await prisma.user.findMany({ where: { username: { in: candidates } }, select: { username: true } });
  const taken = new Set(existing.map(profile => profile.username));
  defaults.suggestedUsername = candidates.find(candidate => !taken.has(candidate)) ?? "";
  return defaults;
}
