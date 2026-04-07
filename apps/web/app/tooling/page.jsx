import Link from "next/link";
import PageShell from "@/components/page-shell";

export const metadata = {
  title: "tooling | FadeThat",
  description: "FadeThat tooling landing page",
};

export default function ToolingPage() {
  return (
    <div className="page-tooling">
      <PageShell>
        <section className="hero">
          <h1>tooling</h1>
          <p className="lede">
            this landing page holds cards for every hosted utility. scraper now lives here, and
            more cards can be dropped in as you launch new tools.
          </p>
        </section>

        <section className="cards" aria-label="tool cards">
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
              <h2>sms optin</h2>
              <p>
                collect explicit consent for service messages and keep submissions logged through
                the opt-in flow.
              </p>
            </div>
            <Link className="cta" href="/optin">
              open optin
            </Link>
          </article>

          <article className="card placeholder">
            <div>
              <span className="chip">soon</span>
              <h2>next drop</h2>
              <p>
                add the next hosted workflow here when you are ready to publish the next internal
                tool.
              </p>
            </div>
            <p className="status-pill">slot ready</p>
          </article>
        </section>
      </PageShell>
    </div>
  );
}
