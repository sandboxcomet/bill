"use client";
import { nameInitial } from "@/lib/name-initial";
import { useI18n } from "@/components/LanguageProvider";
import { useEffect, useRef } from "react";
import Link from "@/components/LocalizedLink";
import { signOut } from "next-auth/react";
import { Icon } from "./Icons";

export default function UserMenu({ name }: { name: string }) {
  const { t, href } = useI18n();
  const menuRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function dismiss(event: Event) {
      const menu = menuRef.current;
      if (menu && !menu.contains(event.target as Node)) menu.open = false;
    }
    function escape(event: KeyboardEvent) {
      const menu = menuRef.current;
      if (event.key === "Escape" && menu?.open) {
        menu.open = false;
        menu.querySelector("summary")?.focus();
      }
    }
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("focusin", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("focusin", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  const close = () => { if (menuRef.current) menuRef.current.open = false; };
  return <details ref={menuRef} className="user-menu">
    <summary className="user-menu-trigger" aria-label={t("nav.userMenu", [name])}>
      <span className="user-menu-avatar" aria-hidden="true">{nameInitial(name)}</span>
      <span className="user-menu-name">{name}</span>
      <svg className="user-menu-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
    </summary>
    <div className="user-menu-panel" role="group" aria-label={t("nav.account")}>
      <p className="user-menu-heading">{name}</p>
      <Link href="/bills" onClick={close}><Icon name="receipt" size={17} />{t("nav.myBills")}</Link>
      <Link href="/friends" onClick={close}><Icon name="users" size={17} />{t("social.pageTitle")}</Link>
      <Link href="/settings" onClick={close}><Icon name="settings" size={17} />{t("nav.accountSettings")}</Link>
      <button type="button" onClick={() => { close(); void signOut({ callbackUrl: href("/") }); }}>
        <Icon name="logout" size={17} />{t("auth.logOut")} </button>
    </div>
  </details>;
}
