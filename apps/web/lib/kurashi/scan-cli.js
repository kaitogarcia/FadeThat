import { spawn } from "child_process";
import os from "os";

// Local dev without an API key: the `claude` CLI on your Claude plan, stripped of tools,
// MCP and settings. Never used on Vercel, where there is no CLI.
export function scanWithCli(images, systemPrompt, schema) {
  const args = [
    "-p",
    "--input-format", "stream-json",
    "--output-format", "stream-json", "--verbose",
    "--no-session-persistence",
    "--tools", "",
    "--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}',
    "--setting-sources", "",
    "--disable-slash-commands",
    "--system-prompt", systemPrompt,
    "--model", "opus",
    "--json-schema", JSON.stringify(schema),
  ];
  const message = {
    type: "user",
    message: {
      role: "user",
      content: [
        ...images.map((img) => ({ type: "image", source: { type: "base64", media_type: img.mediaType, data: img.data } })),
        { type: "text", text: "Extract every expense." },
      ],
    },
  };
  return new Promise((resolve, reject) => {
    // Run from a neutral dir so no project CLAUDE.md is picked up. The ignore comments keep the
    // bundler from tracing the whole project for this dev-only path.
    const child = spawn(/*turbopackIgnore: true*/ process.env.CLAUDE_BIN || "claude", args, {
      cwd: /*turbopackIgnore: true*/ os.tmpdir(),
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("claude timed out"));
    }, 55_000);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      const result = out
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .find((e) => e?.type === "result");
      if (!result?.structured_output || result.is_error) {
        return reject(new Error(`claude exited ${code}: ${String(result?.result || err || out).slice(0, 300)}`));
      }
      resolve(result.structured_output.expenses);
    });
    child.stdin.end(`${JSON.stringify(message)}\n`);
  });
}
