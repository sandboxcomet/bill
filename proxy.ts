import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isLocale, localeFromPath, localizedPath, stripLocale } from "@/lib/locale";

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

  // Shared reads and scoped payments enforce PIN/token access in their handlers.
  if (
    /^\/bill\/[^/]+(?:\/[^/]+)?\/?$/.test(pathname) ||
    (request.method === "GET" && pathname === "/api/bill") ||
    (/^\/api\/bills\/[^/]+\/participants\/[^/]+\/?$/.test(pathname) &&
      ["GET", "POST"].includes(request.method)) ||
    (request.method === "GET" && /^\/api\/payment-evidence\/[^/]+\/?$/.test(pathname))
  ) return next();

  const userId = Number(request.auth?.user?.id);
  if (Number.isSafeInteger(userId) && userId > 0) {
    if (!request.auth?.user?.username && !["/onboarding", "/api/profile", "/settings", "/api/account-connections"].includes(pathname)) {
      if (pathname.startsWith("/api/")) return NextResponse.json({ error: "account.usernameRequired" }, { status: 403, headers: { "Cache-Control": "private, no-store" } });
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
