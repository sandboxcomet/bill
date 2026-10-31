"use client";
import { useId, useRef, useState } from "react";
import { useI18n } from "./LanguageProvider";
import { Icon } from "./Icons";
import styles from "./RestaurantPicker.module.css";

export default function RestaurantPicker({ restaurants, value, index, disabled, onChange, mobile = false }: {
  restaurants: { id: string; name: string }[];
  value?: string | null;
  index: number;
  disabled: boolean;
  mobile?: boolean;
  onChange: (id: string | null) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const selected = restaurants.find(restaurant => restaurant.id === value);
  const choices = [{ id: null, name: t("editor.noRestaurant") }, ...restaurants];
  return <div className={`${styles.picker}${mobile ? ` ${styles.mobile}` : ""}`} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  }} onKeyDown={event => {
    if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus(); }
  }}>
    <span className={styles.label}>{t("editor.restaurantShort")}</span>
    <div className={styles.control}>
      <button ref={trigger} type="button" className={styles.trigger} disabled={disabled}
        aria-label={t("editor.itemRestaurantLabel", [index + 1, selected?.name ?? t("editor.noRestaurant")])}
        aria-expanded={open && !disabled} aria-controls={open && !disabled ? menuId : undefined}
        onClick={() => setOpen(current => !current)}>
        <span>{selected?.name ?? t("editor.noRestaurant")}</span><Icon name="chevron" size={16} />
      </button>
      {open && !disabled && <div id={menuId} className={styles.menu} role="group" aria-label={t("editor.itemRestaurant")}>
        {choices.map(choice => <button key={choice.id ?? "none"} type="button" className={styles.option}
          aria-pressed={(value ?? null) === choice.id} onClick={() => { onChange(choice.id); setOpen(false); trigger.current?.focus(); }}>
          <span>{choice.name}</span>{(value ?? null) === choice.id && <Icon name="check" size={16} />}
        </button>)}
      </div>}
    </div>
  </div>;
}
