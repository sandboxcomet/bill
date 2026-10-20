"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Icon } from "./Icons";
export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { data: session } = useSession();
  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <Link className="brand" href="/" aria-label="WongLao Bill หน้าหลัก">
            <span className="brand-symbol">
              <Icon name="receipt" size={23} />
            </span>
            <span>
              วงเหล้า<span className="brand-divider">/</span>
              <b>bill</b>
            </span>
          </Link>
          <nav aria-label="เมนูหลัก">
            <Link
              className={path === "/" ? "nav-link active" : "nav-link"}
              href="/"
            >
              บิลของฉัน
            </Link>
            <Link
              className={path === "/settings" ? "nav-link active" : "nav-link"}
              href="/settings"
            >
              <Icon name="settings" size={17} />
              <span>บัญชีรับเงิน</span>
            </Link>
          </nav>
          <div className="header-account">
            {session?.user ? (
              <>
                <span className="account-name">{session.user.name}</span>
                <button
                  className="icon-button"
                  onClick={() => signOut({ callbackUrl: "/" })}
                  aria-label="ออกจากระบบ"
                >
                  <Icon name="logout" size={18} />
                </button>
              </>
            ) : (
              <Link className="button button-small secondary" href="/login">
                เข้าสู่ระบบ
                <Icon name="arrow" size={16} />
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className="page-container">{children}</main>
      <footer className="site-footer">
        <span>WongLao Bill</span>
        <span>มื้อนี้แบ่งให้ชัด แล้วนัดกันใหม่</span>
      </footer>
    </>
  );
}
