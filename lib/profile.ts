import { isUsername } from "./social";

export function isNickname(value: unknown): value is string {
  return typeof value === "string" && Boolean(value.trim()) &&
    value.trim().length <= 40 && !/\p{Cc}/u.test(value);
}

export function hasCompleteProfile(user: { username?: unknown; nickname?: unknown } | null | undefined) {
  return Boolean(user && typeof user.username === "string" && isUsername(user.username) && isNickname(user.nickname));
}
