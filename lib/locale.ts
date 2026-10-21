export const locales = ["th", "en"] as const;
export type Locale = (typeof locales)[number];
export const isLocale = (value: unknown): value is Locale => value === "th" || value === "en";
export const localeFromPath = (path: string): Locale | null => {
  const segment = path.split("/")[1];
  return isLocale(segment) ? segment : null;
};
export const stripLocale = (path: string) => path.replace(/^\/(?:th|en)(?=\/|[?#]|$)/, "") || "/";
export function localizedPath(path: string, _locale?: Locale): string {
  if (!path.startsWith("/") || path.startsWith("//") || /^\/api(?:\/|$)/.test(path)) return path;
  const normalized = stripLocale(path);
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}
