import Link from "next/link";
import PageShell from "@/components/page-shell";

export const metadata = {
  title: "stuff | FadeThat",
  description: "FadeThat stuff landing page",
};

export default function StuffPage() {
  return (
    <div className="page-tooling">
      <PageShell>
        <section className="hero">
          <h1>stuff</h1>
          <p className="lede">
            a small drawer for the useful things: tools, posts, notes, and whatever gets shipped
            next.
          </p>
        </section>

        <section className="cards" aria-label="stuff cards">
          <article className="card">
            <div>
              <span className="chip">live</span>
              <h2>scraper</h2>
              <p>
                match track titles with youtube URLs and prepare your download queue from a single
                workflow screen.
              </p>
            </div>
            <Link className="cta" href="/scraper">
              open scraper
            </Link>
          </article>

          <article className="card">
            <div>
              <span className="chip">live</span>
              <h2>manage instagram</h2>
              <p>
                connect a facebook graph token, post photo batches with progress polling, and run
                bulk delete or archive actions across your instagram grid.
              </p>
            </div>
            <Link className="cta" href="/instagram">
              open manager
            </Link>
          </article>

          <article className="card">
            <div>
              <span className="chip">live</span>
              <h2>blog</h2>
              <p>
                read notes, style references, and the small archive of pages that belong behind the
                main site.
              </p>
            </div>
            <Link className="cta" href="/blog">
              open blog
            </Link>
          </article>

          <article className="card">
            <div>
              <span className="chip">live</span>
              <h2>board</h2>
              <p>
                keep a shared sticky-note surface for quick thoughts, links, and scratch work.
              </p>
            </div>
            <Link className="cta" href="/board">
              open board
            </Link>
          </article>

          <article className="card placeholder">
            <div>
              <span className="chip">soon</span>
              <h2>next drop</h2>
              <p>
                add the next hosted workflow here when you are ready to publish the next internal
                thing.
              </p>
            </div>
            <p className="status-pill">slot ready</p>
          </article>
        </section>
      </PageShell>
    </div>
  );
}
