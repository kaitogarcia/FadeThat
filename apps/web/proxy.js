import { NextResponse } from "next/server";
import { hasFullAccess, hasKurashiAccess, isKurashiPath } from "@/lib/front-auth";

const PUBLIC_FILE_PATTERN = /\.[^/]+$/;

export async function proxy(request) {
  const { pathname, search } = request.nextUrl;

  if (
    pathname === "/" ||
    pathname === "/api/front-auth" ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/api/") ||
    PUBLIC_FILE_PATTERN.test(pathname)
  ) {
    return NextResponse.next();
  }

  // /kurashi opens with either password; everything else needs the full-site one.
  const allowed = isKurashiPath(pathname)
    ? await hasKurashiAccess(request.cookies)
    : hasFullAccess(request.cookies);
  if (allowed) {
    return NextResponse.next();
  }

  const redirectUrl = new URL("/", request.url);
  redirectUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
