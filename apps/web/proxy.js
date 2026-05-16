import { NextResponse } from "next/server";
import { FRONT_AUTH_COOKIE, frontAuthToken } from "@/lib/front-auth";

const PUBLIC_FILE_PATTERN = /\.[^/]+$/;

export function proxy(request) {
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

  const isAuthed = request.cookies.get(FRONT_AUTH_COOKIE)?.value === frontAuthToken();
  if (isAuthed) {
    return NextResponse.next();
  }

  const redirectUrl = new URL("/", request.url);
  redirectUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
