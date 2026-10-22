import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { hasKurashiAccess } from "@/lib/front-auth";
import { normalizeDoc } from "@/lib/kurashi/data";
import { commitFiles } from "@/lib/repo-commit";

export const runtime = "nodejs";

// The file the /kurashi page is built from.
const DATA_FILE = "apps/web/data/kurashi.json";
// Vercel caps request bodies at 4.5 MB.
const MAX_BODY_BYTES = 4_000_000;

function fail(status, error) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request) {
  // /api/* skips the site password check, so this route checks the login cookie itself.
  if (!(await hasKurashiAccess(request.cookies))) {
    return fail(401, "Log in on the home page first.");
  }

  // The default login token is public in this repo; never let it save on the live site.
  if (process.env.NODE_ENV === "production" && !process.env.FRONT_AUTH_TOKEN) {
    return fail(500, "Set a private FRONT_AUTH_TOKEN on Vercel before saving.");
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return fail(413, "Too much data to save at once.");
  }

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return fail(400, "Bad request.");
  }

  // Only Kurashi data ever reaches the repo, in a fixed JSON shape at a fixed path.
  const savedAt = Date.now();
  const content = `${JSON.stringify({ savedAt, ...normalizeDoc(body) }, null, 2)}\n`;
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    if (process.env.NODE_ENV === "production") {
      return fail(500, "GITHUB_TOKEN is not set on Vercel.");
    }
    // Local dev: write straight into the repo file.
    await fs.writeFile(path.join(process.cwd(), "data", "kurashi.json"), content);
    return NextResponse.json({ savedAt, mode: "file" });
  }

  try {
    const commitUrl = await commitFiles([{ path: DATA_FILE, content, encoding: "utf-8" }], "Update kurashi data", token);
    return NextResponse.json({ savedAt, mode: "github", commitUrl });
  } catch (error) {
    return fail(502, error.message || "Could not save to GitHub.");
  }
}
