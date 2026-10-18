import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { FRONT_AUTH_COOKIE, frontAuthToken } from "@/lib/front-auth";
import { IMAGE_ID_PATTERN, normalizeCalendar, normalizeMatrices } from "@/lib/goal-matrix";

export const runtime = "nodejs";

// Repo paths: the file the /goals page is built from, and where pasted note images go.
const GOALS_FILE = "apps/web/data/goals.json";
const IMAGES_DIR = "apps/web/public/goal-images";
// Vercel caps request bodies at 4.5 MB.
const MAX_BODY_BYTES = 4_000_000;
const MAX_IMAGE_BYTES = 2_500_000;

function fail(status, error) {
  return NextResponse.json({ error }, { status });
}

// Only real webp/jpeg/png bytes are written, and only under the image's declared extension.
function imageType(bytes) {
  if (bytes.length > 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") {
    return "webp";
  }
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpg";
  }
  if (bytes.length > 8 && bytes.toString("hex", 0, 8) === "89504e470d0a1a0a") {
    return "png";
  }
  return null;
}

async function github(url, token, init = {}) {
  return fetch(`https://api.github.com/repos/${process.env.GITHUB_REPO || "kaitogarcia/FadeThat"}${url}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    cache: "no-store",
  });
}

async function githubJson(url, token, init) {
  const response = await github(url, token, init);
  if (!response.ok) {
    const error = new Error(`GitHub request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

// Commit every file in one commit (Git Data API), so one Save means one redeploy.
async function commitFiles(files, token) {
  const branch = process.env.GITHUB_BRANCH || "main";
  const ref = `/git/refs/heads/${encodeURIComponent(branch)}`;

  const blobs = [];
  for (const file of files) {
    const blob = await githubJson("/git/blobs", token, {
      method: "POST",
      body: JSON.stringify({ content: file.content, encoding: file.encoding }),
    });
    blobs.push({ path: file.path, mode: "100644", type: "blob", sha: blob.sha });
  }

  // Retry once if someone else committed between our read and write.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const head = await githubJson(ref, token);
    const parent = await githubJson(`/git/commits/${head.object.sha}`, token);
    const tree = await githubJson("/git/trees", token, {
      method: "POST",
      body: JSON.stringify({ base_tree: parent.tree.sha, tree: blobs }),
    });
    const commit = await githubJson("/git/commits", token, {
      method: "POST",
      body: JSON.stringify({ message: "Update goal matrices", tree: tree.sha, parents: [head.object.sha] }),
    });
    const update = await github(ref, token, {
      method: "PATCH",
      body: JSON.stringify({ sha: commit.sha, force: false }),
    });
    if (update.ok) {
      return commit.html_url || null;
    }
    if (update.status !== 422) {
      throw new Error(`GitHub write failed (${update.status}).`);
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
    return fail(413, "Too many new images to save at once. Save a few, then the rest.");
  }

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return fail(400, "Bad request.");
  }

  // Only goal data ever reaches the repo, in a fixed JSON shape at a fixed path.
  const savedAt = Date.now();
  const doc = {
    savedAt,
    matrices: normalizeMatrices(body?.matrices),
    calendar: normalizeCalendar(body?.calendar),
  };

  // New images: only ones the notes reference, with bytes matching their extension.
  const referenced = new Map(doc.matrices.flatMap((m) => m.images.map((image) => [image.id, image.ext])));
  const images = [];
  const incoming = body?.images && typeof body.images === "object" ? Object.entries(body.images) : [];
  for (const [id, base64] of incoming) {
    if (!IMAGE_ID_PATTERN.test(id) || !referenced.has(id) || typeof base64 !== "string") {
      continue;
    }
    const bytes = Buffer.from(base64, "base64");
    const ext = referenced.get(id);
    if (bytes.length > MAX_IMAGE_BYTES || imageType(bytes) !== ext) {
      return fail(400, "One of the pasted images could not be saved.");
    }
    images.push({ name: `${id}.${ext}`, bytes });
  }

  const content = `${JSON.stringify(doc, null, 2)}\n`;
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    if (process.env.NODE_ENV === "production") {
      return fail(500, "GITHUB_TOKEN is not set on Vercel.");
    }
    // Local dev: write straight into the repo files.
    const imageDir = path.join(process.cwd(), "public", "goal-images");
    if (images.length) {
      await fs.mkdir(imageDir, { recursive: true });
    }
    for (const image of images) {
      await fs.writeFile(path.join(imageDir, image.name), image.bytes);
    }
    await fs.writeFile(path.join(process.cwd(), "data", "goals.json"), content);
    return NextResponse.json({ savedAt, mode: "file" });
  }

  try {
    const commitUrl = await commitFiles(
      [
        ...images.map((image) => ({
          path: `${IMAGES_DIR}/${image.name}`,
          content: image.bytes.toString("base64"),
          encoding: "base64",
        })),
        { path: GOALS_FILE, content, encoding: "utf-8" },
      ],
      token
    );
    return NextResponse.json({ savedAt, mode: "github", commitUrl });
  } catch (error) {
    return fail(502, error.message || "Could not save to GitHub.");
  }
}
