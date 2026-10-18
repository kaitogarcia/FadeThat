import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { FRONT_AUTH_COOKIE, frontAuthToken } from "@/lib/front-auth";
import { normalizeCalendar, normalizeMatrices } from "@/lib/goal-matrix";

export const runtime = "nodejs";

// Repo path of the file the /goals page is built from.
const GOALS_FILE = "apps/web/data/goals.json";
const MAX_BODY_BYTES = 1_000_000;

function fail(status, error) {
  return NextResponse.json({ error }, { status });
}

async function github(url, token, init = {}) {
  return fetch(url, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });
}

async function commitToGitHub(content, token) {
  const repo = process.env.GITHUB_REPO || "kaitogarcia/FadeThat";
  const branch = process.env.GITHUB_BRANCH || "main";
  const url = `https://api.github.com/repos/${repo}/contents/${GOALS_FILE}`;

  // Retry once if someone else committed between our read and write.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const current = await github(`${url}?ref=${encodeURIComponent(branch)}`, token);
    if (!current.ok && current.status !== 404) {
      throw new Error(`GitHub read failed (${current.status}).`);
    }
    const sha = current.ok ? (await current.json()).sha : undefined;

    const write = await github(url, token, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Update goal matrices",
        content: Buffer.from(content).toString("base64"),
        branch,
        sha,
      }),
    });

    if (write.ok) {
      const payload = await write.json();
      return payload.commit?.html_url || null;
    }
    if (write.status !== 409 && write.status !== 422) {
      throw new Error(`GitHub write failed (${write.status}).`);
    }
  }
  throw new Error("GitHub write conflicted twice. Try saving again.");
}

export async function POST(request) {
  // /api/* skips the site password check, so this route checks the login cookie itself.
  if (request.cookies.get(FRONT_AUTH_COOKIE)?.value !== frontAuthToken()) {
    return fail(401, "Log in on the home page first.");
  }

  // The default login token is public in this repo; never let it save on the live site.
  if (process.env.NODE_ENV === "production" && !process.env.FRONT_AUTH_TOKEN) {
    return fail(500, "Set a private FRONT_AUTH_TOKEN on Vercel before saving.");
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return fail(413, "Too much data to save.");
  }

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return fail(400, "Bad request.");
  }

  // Only goal text ever reaches the repo, in a fixed JSON shape at a fixed path.
  const savedAt = Date.now();
  const doc = {
    savedAt,
    matrices: normalizeMatrices(body?.matrices),
    calendar: normalizeCalendar(body?.calendar),
  };
  const content = `${JSON.stringify(doc, null, 2)}\n`;
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    if (process.env.NODE_ENV === "production") {
      return fail(500, "GITHUB_TOKEN is not set on Vercel.");
    }
    // Local dev: write straight into the repo file.
    await fs.writeFile(path.join(process.cwd(), "data", "goals.json"), content);
    return NextResponse.json({ savedAt, mode: "file" });
  }

  try {
    const commitUrl = await commitToGitHub(content, token);
    return NextResponse.json({ savedAt, mode: "github", commitUrl });
  } catch (error) {
    return fail(502, error.message || "Could not save to GitHub.");
  }
}
