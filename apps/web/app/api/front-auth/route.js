import { NextResponse } from "next/server";
import {
  FRONT_AUTH_COOKIE,
  FRONT_PASSWORD,
  KURASHI_AUTH_COOKIE,
  KURASHI_PASSWORD,
  frontAuthToken,
  isKurashiPath,
  kurashiAuthToken,
  normalizeFrontAuthRedirect,
} from "@/lib/front-auth";

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};

export async function POST(request) {
  const formData = await request.formData();
  const password = String(formData.get("password") || "");
  const nextPath = normalizeFrontAuthRedirect(String(formData.get("next") || "/"));

  if (password === FRONT_PASSWORD) {
    const response = NextResponse.redirect(new URL(nextPath, request.url), { status: 303 });
    response.cookies.set({ name: FRONT_AUTH_COOKIE, value: frontAuthToken(), ...COOKIE_OPTIONS });
    return response;
  }

  if (password === KURASHI_PASSWORD) {
    // Kurashi-only access: always land somewhere inside /kurashi.
    const target = isKurashiPath(nextPath) ? nextPath : "/kurashi";
    const response = NextResponse.redirect(new URL(target, request.url), { status: 303 });
    response.cookies.set({ name: KURASHI_AUTH_COOKIE, value: await kurashiAuthToken(), ...COOKIE_OPTIONS });
    return response;
  }

  const failureUrl = new URL("/", request.url);
  failureUrl.searchParams.set("front_error", "1");
  failureUrl.searchParams.set("next", nextPath);
  return NextResponse.redirect(failureUrl, { status: 303 });
}
