import PageShell from "@/components/page-shell";

export const metadata = {
  title: "My Mac Stack | Blog",
  description: "The apps, hotkeys, and key remaps on my Mac.",
};

const tildeLayer = [
  ["` + q", "4"],
  ["` + w", "5"],
  ["` + e", "6"],
  ["` + a", "7"],
  ["` + s", "8"],
  ["` + d", "9"],
  ["` + space", "0"],
  ["tap `", "` (shift + ` still types ~)"],
];

const hammerspoonKeys = [
  ["hyper + arrows", "snap window to left / right / top / bottom half"],
  ["hyper + f", "maximize window"],
  ["hyper + c", "center window"],
  ["hyper + n", "move window to next screen"],
  ["hyper + t / b / e", "open terminal / safari / finder"],
  ["hyper + a", "toggle auto-copy (highlighted text gets copied)"],
  ["hyper + r", "reload config"],
];

const groups = [
  {
    title: "local ai",
    items: [
      ["ollama", "runs ai models on the laptop. gemma4 for chat, nomic-embed-text for search embeddings."],
      ["dicta", "dictation"],
    ],
  },
  {
    title: "coding",
    items: [
      ["editors", "cursor, vs code, xcode"],
      ["terminal", "warp"],
      ["ai", "claude, claude code, codex"],
      ["runtimes", "node, deno, python, ruby, java"],
      ["mobile", "cocoapods, watchman, maestro for ui tests, respectaso for app store keywords"],
      ["cli", "gh, cloudflared"],
    ],
  },
  {
    title: "video + audio",
    items: [
      ["edit", "premiere pro, media encoder, imovie"],
      ["music", "logic pro, garageband"],
      ["cli", "ffmpeg, yt-dlp"],
    ],
  },
  {
    title: "everything else",
    items: [
      ["design", "inkscape"],
      ["office", "pages, numbers, keynote"],
      ["misc", "displaylink, spotify, minecraft, 9d breathwork"],
    ],
  },
];

function KeyRows({ rows, label }) {
  return (
    <div className="blog-chart" role="table" aria-label={label}>
      {rows.map(([key, value]) => (
        <div className="blog-chart-row" role="row" key={key}>
          <span role="cell" className="blog-chart-head">
            {key}
          </span>
          <span role="cell">{value}</span>
        </div>
      ))}
    </div>
  );
}

export default function MacStackPage() {
  return (
    <div className="page-blog stylebook-page">
      <PageShell>
        <article className="stylebook-wrap">
          <p className="stylebook-date">2026-10-14</p>
          <h1>my mac stack</h1>

          <section className="stylebook-block">
            <h2>karabiner-elements: number layer</h2>
            <p>hold the ` key and the left hand becomes a number pad.</p>
            <KeyRows rows={tildeLayer} label="Tilde number layer" />
          </section>

          <section className="stylebook-block">
            <h2>hammerspoon: hotkeys + windows</h2>
            <p>the mac version of autohotkey. hyper = cmd + alt + ctrl.</p>
            <KeyRows rows={hammerspoonKeys} label="Hammerspoon hotkeys" />
          </section>

          <section className="stylebook-block">
            <h2>shottr + copyclip</h2>
            <KeyRows
              label="Screenshot and clipboard tools"
              rows={[
                ["shottr", "screenshots, markup, scrolling capture, ocr, pinned shots"],
                ["copyclip", "clipboard history. pairs with hammerspoon auto-copy."],
              ]}
            />
          </section>

          {groups.map((group) => (
            <section className="stylebook-block" key={group.title}>
              <h2>{group.title}</h2>
              <KeyRows rows={group.items} label={group.title} />
            </section>
          ))}
        </article>
      </PageShell>
    </div>
  );
}
