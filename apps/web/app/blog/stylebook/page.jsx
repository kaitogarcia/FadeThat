import PageShell from "@/components/page-shell";

export const metadata = {
  title: "Fade That Style Book | Blog",
  description: "Typeface and component style references for FadeThat.",
};

export default function StyleBookPage() {
  return (
    <div className="page-blog stylebook-page">
      <PageShell>
        <article className="stylebook-wrap">
          <p className="stylebook-date">2026-04-09</p>
          <h1>fade that style book</h1>

          <section className="stylebook-block">
            <h2>Helvetica</h2>
            <p className="font-demo helvetica-demo">ABCDEFGHIJKLMNOPQRSTUVWXYZ</p>
            <p className="font-demo helvetica-demo">abcdefghijklmnopqrstuvwxyz</p>
          </section>

          <section className="stylebook-block">
            <h2>Courier New</h2>
            <p className="font-demo courier-demo">THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG</p>
            <p className="font-demo courier-demo">the quick brown fox jumps over the lazy dog</p>
          </section>

          <section className="stylebook-block">
            <h2>Apercu Mono Pro Regular</h2>
            <p className="font-demo apercu-demo">THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG</p>
            <p className="font-demo apercu-demo">the quick brown fox jumps over the lazy dog</p>
          </section>

          <section className="stylebook-block">
            <h2>component demos</h2>

            <div className="stylebook-box-row">
              <div className="stylebook-box">box component / small</div>
              <div className="stylebook-box">box component / medium</div>
              <div className="stylebook-box">box component / large</div>
            </div>

            <nav className="stylebook-nav-demo" aria-label="Nav bar component demo">
              <a href="#">fade</a>
              <a href="#">tooling</a>
              <a href="#">blog</a>
              <a href="#">board</a>
            </nav>
          </section>
        </article>
      </PageShell>
    </div>
  );
}
