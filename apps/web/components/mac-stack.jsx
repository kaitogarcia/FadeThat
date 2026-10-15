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

const chromeShortcuts = [
  ["opt + a", "select previous tab"],
  ["opt + d", "select next tab"],
  ["opt + shift + a", "move current tab left"],
  ["opt + shift + d", "move current tab right"],
  ["cmd + d", "duplicate current tab"],
  ["opt + s", "go back to the previous page"],
];

const groups = [
  {
    title: "building",
    items: [
      ["setup", "warp + claude max"],
      ["ide", "none 😂"],
      ["runtimes", "node, deno, python, ruby, java"],
      ["mobile", "cocoapods, watchman, maestro for ui tests, respectaso for app store keywords"],
      ["cli", "gh, cloudflared"],
    ],
  },
  {
    title: "local ai",
    items: [
      ["ollama", "runs ai models on the laptop. gemma4 for chat, nomic-embed-text for search embeddings."],
      ["dicta", "dictation"],
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

export default function MacStack() {
  return (
    <article className="stylebook-wrap mac-stack" aria-labelledby="mac-stack-title">
      <h2 id="mac-stack-title" className="mac-stack-title">
        my mac stack
      </h2>

      <section className="stylebook-block">
        <h2>building</h2>
        <KeyRows rows={groups[0].items} label="building" />
      </section>

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
        <h2>chrome</h2>
        <KeyRows
          label="Chrome extensions"
          rows={[
            ["dark reader", "dark mode on every site"],
            ["keyboard shortcuts", "custom tab hotkeys (below)"],
          ]}
        />
        <p>
          <a
            href="https://chromewebstore.google.com/detail/keyboard-shortcuts/lplcmnhgijkkmflbmhabnccgelffpnog"
            target="_blank"
            rel="noreferrer"
          >
            get keyboard shortcuts
          </a>
        </p>
        <KeyRows rows={chromeShortcuts} label="Chrome tab shortcuts" />
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

      {groups.slice(1).map((group) => (
        <section className="stylebook-block" key={group.title}>
          <h2>{group.title}</h2>
          <KeyRows rows={group.items} label={group.title} />
        </section>
      ))}
    </article>
  );
}
