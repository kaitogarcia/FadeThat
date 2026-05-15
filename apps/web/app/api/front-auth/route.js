import { NextResponse } from "next/server";
import { FRONT_AUTH_COOKIE, FRONT_PASSWORD, frontAuthToken } from "@/lib/front-auth";

export async function POST(request) {
  const formData = await request.formData();
  const password = String(formData.get("password") || "");
  const redirectUrl = new URL("/", request.url);

  if (password !== FRONT_PASSWORD) {
    redirectUrl.searchParams.set("front_error", "1");
    return NextResponse.redirect(redirectUrl, { status: 303 });
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
