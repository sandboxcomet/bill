"use client";
import { useI18n } from "@/components/LanguageProvider";
import Link from "@/components/LocalizedLink";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { stripLocale } from "@/lib/locale";
import { Icon } from "./Icons";
import UserMenu from "./UserMenu";
import LanguageMenu from "./LanguageMenu";
import Notifications from "./Notifications";
export default function Shell({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const { data: session } = useSession();
  const pathname = stripLocale(usePathname());
  const isMyBills = pathname === "/bills" || pathname.startsWith("/bills/") || pathname.startsWith("/manage/");
  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <Link className="brand" href="/" aria-label={t("nav.brandHome")}>
            <img className="brand-logo" src="/brand-mark.svg?v=clear-toh-friends-1" width={40} height={40} alt="" aria-hidden="true" />
            <span className="brand-wordmark">
              <span className="brand-product" lang="th">เคลียร์โต๊ะ</span>
              <span className="brand-english" lang="en">Clear Toh</span>
            </span>
          </Link>
          <nav className="desktop-nav" aria-label={t("nav.main")}>
            {session?.user && <Link className={`nav-link${pathname === "/dashboard" ? " active" : ""}`} href="/dashboard" aria-current={pathname === "/dashboard" ? "page" : undefined}>{t("nav.dashboard")}</Link>}
            <Link className={`nav-link${isMyBills ? " active" : ""}`} href="/bills" aria-current={isMyBills ? "page" : undefined}>
              {t("nav.myBills")}
            </Link>
          </nav>
          <div className="header-account">
            <LanguageMenu />
            {session?.user && <Notifications />}
            {session?.user ? (
              <UserMenu name={session.user.nickname || session.user.name || t("nav.myAccount")}
                email={session.user.email} username={session.user.username} provider={session.user.loginProvider} />
            ) : (
              <>
                <Link className="button button-small secondary header-login" href="/login" aria-label={t("auth.logIn")}>
                  <span className="header-login-label">{t("auth.logIn")}</span><Icon name="login" size={16} />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="page-container">{children}</main>
      <footer className="site-footer">
        <span>เคลียร์โต๊ะ · Clear Toh</span>
        <span>{t("brand.tagline")}</span>
      </footer>
    </>
  );
}
