export const FRONT_AUTH_COOKIE = "fadethat_front_auth";
export const FRONT_PASSWORD = process.env.FRONT_PAGE_PASSWORD || "heybaby";
export const FRONT_AUTH_TOKEN =
  process.env.FRONT_AUTH_TOKEN || "afd8e27e687d80c42dc88f5c1b7548d3cb7e4ba277c36282366c8e9d614342f1";

export function frontAuthToken() {
  return FRONT_AUTH_TOKEN;
}

export function normalizeFrontAuthRedirect(value) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  return value;
}
