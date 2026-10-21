import { english } from "./translations/en";
import { thai, type TranslationKey } from "./translations/th";
import type { Locale } from "./locale";

export type { TranslationKey } from "./translations/th";
export type Translate = (key: TranslationKey, values?: readonly unknown[]) => string;
export function isTranslationKey(value: string): value is TranslationKey {
  return Object.hasOwn(thai, value);
}
const interpolate = (message: string, values: readonly unknown[]) =>
  message.replace(/\{(\d+)\}/g, (match, index) =>
    Number(index) < values.length ? String(values[Number(index)] ?? "") : match);

export function translate(locale: Locale, key: TranslationKey, values: readonly unknown[] = []): string {
  return interpolate((locale === "en" ? english[key] : thai[key]) ?? thai[key] ?? key, values);
}

// API responses still contain human-readable messages. Keep that boundary separate
// from typed UI keys, including feedback already stored before a locale switch.
const messageKeys = new Map<string, TranslationKey>();
for (const key of Object.keys(thai) as TranslationKey[]) {
  messageKeys.set(thai[key], key);
  messageKeys.set(english[key], key);
}
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const feedbackPatterns = (Object.keys(thai) as TranslationKey[]).flatMap(key =>
  [thai[key], english[key]].filter(message => /\{\d+\}/.test(message)).map(message => ({
    key,
    expression: new RegExp(`^${message.split(/\{\d+\}/).map(escape).join("(.+?)")}$`),
    order: [...message.matchAll(/\{(\d+)\}/g)].map(match => Number(match[1])),
  })));

export function translateFeedback(locale: Locale, message: string): string {
  if (isTranslationKey(message)) return translate(locale, message);
  const key = messageKeys.get(message);
  if (key) return translate(locale, key);
  for (const pattern of feedbackPatterns) {
    const match = pattern.expression.exec(message);
    if (!match) continue;
    const values: string[] = [];
    pattern.order.forEach((index, i) => { values[index] = match[i + 1]; });
    return translate(locale, pattern.key, values);
  }
  return message;
}
