"use client";
import { useEffect } from "react";
import type { Session } from "next-auth";
import { SessionProvider, useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { stripLocale } from "@/lib/locale";
import { useI18n } from "./LanguageProvider";

function SessionGate({ children }: { children: React.ReactNode }) {
  const pathname = stripLocale(usePathname());
  const { href, t } = useI18n();
  const router = useRouter();
  const { data: session, status } = useSession();
  const isPublicPage =
    pathname === "/" || pathname === "/demo" || pathname === "/login" ||
    /^\/bill\/[^/]+(?:\/[^/]+)?\/?$/.test(pathname);
  const userId = Number(session?.user?.id);
  // A session refresh keeps the previous authenticated data while loading.
  const authenticated =
    Boolean(session?.user) && Number.isSafeInteger(userId) && userId > 0;

  const needsUsername = authenticated && !session?.user?.username && !isPublicPage && pathname !== "/onboarding";
  useEffect(() => {
    if (needsUsername) {
      router.replace(href(`/onboarding?callbackUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`));
      return;
    }
    if (!isPublicPage && status !== "loading" && !authenticated) {
      const destination = window.location.pathname + window.location.search;
      router.replace(href(`/login?callbackUrl=${encodeURIComponent(destination)}`));
    }
  }, [authenticated, isPublicPage, needsUsername, router, status]);

  if ((!isPublicPage && !authenticated) || needsUsername) {
    return (
      <div id="content" className="empty-state" role="status">
        <span className="spinner" />
        {t("common.checkingYourLogin")}
      </div>
    );
  }
  return children;
}

export default function Providers({
  children,
  session,
}: {
  children: React.ReactNode;
  session: Session | null;
}) {
  return (
    <SessionProvider session={session} refetchInterval={60}>
      <SessionGate>{children}</SessionGate>
    </SessionProvider>
  );
}
