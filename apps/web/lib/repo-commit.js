// Commit files to the repo through the GitHub Git Data API: every file in one commit, so one
// Save means one Vercel redeploy. Same mechanism as app/api/goals/save.

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
    throw new Error(`GitHub request failed (${response.status}).`);
  }
  return response.json();
}

/** files: [{ path, content, encoding: "utf-8" | "base64" }]. Returns the commit URL. */
export async function commitFiles(files, message, token) {
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
      body: JSON.stringify({ message, tree: tree.sha, parents: [head.object.sha] }),
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
