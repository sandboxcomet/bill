"use client";
import { useI18n } from "@/components/LanguageProvider";

import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icons";

export default function PartsHelp({ id }: { id: string }) {
  const { t } = useI18n();
  const [mode, setMode] = useState<"closed" | "hover" | "focus" | "pinned">(
    "closed",
  );
  const [placement, setPlacement] = useState<"top" | "bottom">("bottom");
  const container = useRef<HTMLDivElement>(null);
  const tooltip = useRef<HTMLDivElement>(null);
  const open = mode !== "closed";
  const tooltipId = `parts-tooltip-${id}`;

  useEffect(() => {
    if (!open) return;
    const position = () => {
      if (!container.current || !tooltip.current) return;
      const trigger = container.current.getBoundingClientRect();
      const height = tooltip.current.getBoundingClientRect().height;
      setPlacement(
        window.innerHeight - trigger.bottom < height && trigger.top >= height
          ? "top"
          : "bottom",
      );
    };
    const dismissOutside = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setMode("closed");
    };
    const dismissEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMode("closed");
    };
    position();
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("keydown", dismissEscape);
    return () => {
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("keydown", dismissEscape);
    };
  }, [open]);

  return (
    <div
      className="parts-heading-row"
      ref={container}
      onPointerLeave={() => {
        if (mode === "hover") setMode("closed");
      }}
    >
      <span className="parts-heading">{t("split.splitByShares")}</span>
      <button
        type="button"
        className="parts-help-trigger"
        aria-label={t("split.helpTitle")}
        aria-describedby={tooltipId}
        aria-controls={tooltipId}
        aria-expanded={open}
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse" && mode === "closed") {
            setMode("hover");
          }
        }}
        onFocus={() => setMode("focus")}
        onBlur={() => setMode("closed")}
        onClick={() => setMode(mode === "pinned" ? "closed" : "pinned")}
      >
        <Icon name="help" size={18} />
      </button>
      <div
        ref={tooltip}
        id={tooltipId}
        role="tooltip"
        className="parts-tooltip"
        data-placement={placement}
        hidden={!open}
      >
        <strong>{t("split.whenToUse")}</strong>
        <p>{t("split.exampleTotal")}</p>
        <ul>
          <li> {t("split.yourExample")} <b>{t("split.2Shares")}</b> {t("split.andPay")} <b>{t("split.200Baht")}</b>
          </li>
          <li> {t("split.friendExample")} <b>{t("split.1Share")}</b> {t("split.andPay")} <b>{t("split.100Baht")}</b>
          </li>
        </ul>
        <p> {t("split.equalSplitHint")} </p>
      </div>
    </div>
  );
}
