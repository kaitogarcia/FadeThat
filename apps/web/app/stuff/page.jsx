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
          <p className="lede">shipping all tooling here</p>
        </section>

        <section className="cards" aria-label="stuff cards">
          <article className="card">
            <div>
              <h2>setlist to mp3</h2>
              <p>
                match track titles with youtube URLs and prepare your download queue from a single
                workflow screen.
              </p>
            </div>
            <Link className="cta" href="/scraper">
              open
            </Link>
          </article>

          <article className="card">
            <div>
              <h2>instagram post agent</h2>
              <p>
                connect a facebook graph token, post photo batches with progress polling, and run
                bulk delete or archive actions across your instagram grid.
              </p>
            </div>
            <Link className="cta" href="/instagram">
              open
            </Link>
          </article>

          <article className="card">
            <div>
              <span className="chip chip-live">live</span>
              <h2>blog</h2>
              <p>
                read notes, style references, and the small archive of pages that belong behind the
                main site.
              </p>
            </div>
            <Link className="cta" href="/blog">
              open
            </Link>
          </article>

          <article className="card">
            <div>
              <span className="chip chip-live">live</span>
              <h2>board</h2>
              <p>
                keep a shared sticky-note surface for quick thoughts, links, and scratch work.
              </p>
            </div>
            <Link className="cta" href="/board">
              open
            </Link>
          </article>

          <article className="card">
            <div>
              <span className="chip chip-live">live</span>
              <h2>goal matrices</h2>
              <p>
                9x9 goal charts: one main goal, eight sub-goals, eight actions each. zoom from all
                goals into a single block and edit as you go.
              </p>
            </div>
            <Link className="cta" href="/goals">
              open
            </Link>
          </article>

          <article className="card">
            <div>
              <span className="chip chip-live">live</span>
              <h2>kurashi</h2>
              <p>
                to-do lists for a day, a week, a month or a year, and a budget book that reads
                receipts and payment screenshots and totals each month by category.
              </p>
            </div>
            <Link className="cta" href="/kurashi">
              open
            </Link>
          </article>
        </section>
      </PageShell>
    </div>
  );
}
