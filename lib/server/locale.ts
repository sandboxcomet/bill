import { headers } from "next/headers";
import { isLocale, type Locale } from "@/lib/locale";
export async function requestLocale(): Promise<Locale> {
  const value = (await headers()).get("x-clear-toh-locale");
  return isLocale(value) ? value : "th";
}
