const keyboardShortcutsUrl =
  "https://chromewebstore.google.com/detail/keyboard-shortcuts/lplcmnhgijkkmflbmhabnccgelffpnog";

const sections = [
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
    title: "mac tools",
    items: [
      [
        "karabiner-elements",
        "hold ` and the left hand becomes a number pad\n" +
          "` + q = 4\n` + w = 5\n` + e = 6\n` + a = 7\n` + s = 8\n` + d = 9\n` + space = 0\n" +
          "tap ` still types ` (shift + ` types ~)",
      ],
      [
        "hammerspoon",
        "the mac version of autohotkey. hyper = cmd + alt + ctrl\n" +
          "hyper + arrows = snap window to left / right / top / bottom half\n" +
          "hyper + f = maximize window\n" +
          "hyper + c = center window\n" +
          "hyper + n = move window to next screen\n" +
          "hyper + t / b / e = open terminal / safari / finder\n" +
          "hyper + a = toggle auto-copy (highlighted text gets copied)\n" +
          "hyper + r = reload config",
      ],
      ["shottr", "screenshots, markup, scrolling capture, ocr, pinned shots"],
      ["copyclip", "clipboard history. pairs with hammerspoon auto-copy."],
      ["ollama", "runs ai models on the laptop. gemma4 for chat, nomic-embed-text for search embeddings."],
      [
        "trackpad speed",
        "defaults write -g com.apple.trackpad.scaling -float 5.0\n" +
          "faster than the system settings max (3.0). log out and back in to apply.",
      ],
    ],
  },
  {
    title: "chrome",
    items: [
      ["dark reader", "opt + r to toggle"],
      [
        "keyboard shortcuts",
        <>
          {"opt + a = select previous tab\n" +
            "opt + d = select next tab\n" +
            "opt + shift + a = move current tab left\n" +
            "opt + shift + d = move current tab right\n" +
            "cmd + d = duplicate current tab\n" +
            "opt + s = go back to the previous page\n"}
          <a href={keyboardShortcutsUrl} target="_blank" rel="noreferrer">
            link
          </a>
        </>,
      ],
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

export default function MacStack() {
  return (
    <article className="stylebook-wrap mac-stack" aria-labelledby="mac-stack-title">
      <h2 id="mac-stack-title" className="mac-stack-title">
        my mac stack
      </h2>

      {sections.map((section) => (
        <section className="stylebook-block" key={section.title}>
          <h2>{section.title}</h2>
          <div className="blog-chart" role="table" aria-label={section.title}>
            {section.items.map(([name, desc]) => (
              <div className="blog-chart-row" role="row" key={name}>
                <span role="cell" className="blog-chart-head">
                  {name}
                </span>
                <span role="cell" className="mac-stack-desc">
                  {desc}
                </span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </article>
  );
}
