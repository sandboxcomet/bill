"use client";

import { useEffect } from "react";
import { useI18n } from "@/components/LanguageProvider";

// Private names come from an authorized bill/payment response only.
export function useBillTitle(name: string | undefined) {
  const { t } = useI18n();
  useEffect(() => {
    if (name) document.title = t("meta.titleTemplate").replace("%s", () => name);
  }, [name, t]);
}
