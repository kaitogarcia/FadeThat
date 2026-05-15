import { createHash } from "node:crypto";

export const FRONT_AUTH_COOKIE = "fadethat_front_auth";
export const FRONT_PASSWORD = process.env.FRONT_PAGE_PASSWORD || "heybaby";

export function frontAuthToken() {
  const secret = process.env.FRONT_AUTH_SECRET || "fadethat-front-lock";
  return createHash("sha256").update(`${FRONT_PASSWORD}:${secret}`).digest("hex");
}
