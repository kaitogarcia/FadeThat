import { NextResponse } from "next/server";
import {
  FRONT_AUTH_COOKIE,
  FRONT_PASSWORD,
  frontAuthToken,
  normalizeFrontAuthRedirect,
} from "@/lib/front-auth";

export async function POST(request) {
  const formData = await request.formData();
  const password = String(formData.get("password") || "");
  const nextPath = normalizeFrontAuthRedirect(String(formData.get("next") || "/"));
  const redirectUrl = new URL(nextPath, request.url);

  if (password !== FRONT_PASSWORD) {
    const failureUrl = new URL("/", request.url);
    failureUrl.searchParams.set("front_error", "1");
    failureUrl.searchParams.set("next", nextPath);
    return NextResponse.redirect(failureUrl, { status: 303 });
  }

  const response = NextResponse.redirect(redirectUrl, { status: 303 });
  response.cookies.set({
    name: FRONT_AUTH_COOKIE,
    value: frontAuthToken(),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
