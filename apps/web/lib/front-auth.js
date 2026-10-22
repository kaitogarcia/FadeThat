export const FRONT_AUTH_COOKIE = "fadethat_front_auth";
export const KURASHI_AUTH_COOKIE = "fadethat_kurashi_auth";

// "hello" unlocks the whole site; "hi" unlocks only /kurashi.
export const FRONT_PASSWORD = "hello";
export const KURASHI_PASSWORD = "hi";

export const FRONT_AUTH_TOKEN =
  process.env.FRONT_AUTH_TOKEN || "afd8e27e687d80c42dc88f5c1b7548d3cb7e4ba277c36282366c8e9d614342f1";

export function frontAuthToken() {
  return FRONT_AUTH_TOKEN;
}

// The kurashi-only cookie holds a hash of the private site token, so it can't be turned
// back into the full-access token.
export async function kurashiAuthToken() {
  const data = new TextEncoder().encode(`kurashi:${FRONT_AUTH_TOKEN}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// `cookies` is anything with `get(name)?.value`: request.cookies or next/headers cookies().
export function hasFullAccess(cookies) {
  return cookies.get(FRONT_AUTH_COOKIE)?.value === frontAuthToken();
}

export async function hasKurashiAccess(cookies) {
  if (hasFullAccess(cookies)) {
    return true;
  }
  const value = cookies.get(KURASHI_AUTH_COOKIE)?.value;
  return Boolean(value) && value === (await kurashiAuthToken());
}

export function isKurashiPath(pathname) {
  return pathname === "/kurashi" || pathname.startsWith("/kurashi/");
}

export function normalizeFrontAuthRedirect(value) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  return value;
}
