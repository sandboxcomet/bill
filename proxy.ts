import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isLocale, localeFromPath, localizedPath, stripLocale } from "@/lib/locale";
import { hasCompleteProfile } from "@/lib/profile";

export const proxy = auth((request) => {
  const originalPath = request.nextUrl.pathname;
  const pathname = stripLocale(originalPath);
  const { search } = request.nextUrl;
  const prefix = localeFromPath(originalPath);
  const stored = request.cookies.get("clear-toh-locale")?.value;
  const locale = prefix ?? (isLocale(stored) ? stored : "th");
  const next = () => {
    const headers = new Headers(request.headers);
    headers.set("x-clear-toh-locale", locale);
    return NextResponse.next({ request: { headers } });
  };
  if (prefix) {
    if (pathname === "/api" || pathname.startsWith("/api/")) return new NextResponse(null, { status: 404 });
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    const response = NextResponse.redirect(url);
    response.cookies.set("clear-toh-locale", locale, {
      path: "/", maxAge: 31536000, sameSite: "lax", secure: request.nextUrl.protocol === "https:",
    });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
  if (
    pathname === "/" ||
    pathname === "/demo" ||
    pathname === "/login" ||
    pathname === "/api/auth" ||
    pathname.startsWith("/api/auth/") ||
    pathname === "/api/health" ||
    (request.method === "POST" && pathname === "/api/webhooks/easyslip")
  ) {
    return next();
  }

  // The shared receipt stays public/PIN-protected. Every payment route requires
  // a signed-in account with a complete profile in addition to its scoped token.
  if (
    /^\/bill\/[^/]+\/?$/.test(pathname) ||
    (request.method === "GET" && pathname === "/api/bill") ||
    (request.method === "GET" && /^\/api\/bills\/[^/]+\/participants\/[^/]+\/expenses\/?$/.test(pathname))
  ) return next();

  const userId = Number(request.auth?.user?.id);
  if (Number.isSafeInteger(userId) && userId > 0) {
    if (!hasCompleteProfile(request.auth?.user) && !["/onboarding", "/api/profile"].includes(pathname)) {
      if (pathname.startsWith("/api/")) return NextResponse.json({ error: request.auth?.user?.username ? "account.nicknameRequired" : "account.usernameRequired" }, { status: 403, headers: { "Cache-Control": "private, no-store" } });
      const setup = new URL("/onboarding", request.url);
      setup.searchParams.set("callbackUrl", originalPath + search);
      return NextResponse.redirect(setup);
    }
    return next();
  }

  if (pathname === "/api" || pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "กรุณาเข้าสู่ระบบก่อนใช้งาน" },
      { status: 401, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const login = new URL(localizedPath("/login", locale), request.url);
  login.searchParams.set("callbackUrl", originalPath + search);
  return NextResponse.redirect(login);
});

export const config = {
  matcher: ["/((?!_next/|favicon\\.ico$|brand-mark\\.svg$|icon\\.svg$|icon\\.png$).*)"],
};
