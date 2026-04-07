import ScraperWorkflow from "@/components/scraper-workflow";
import PageShell from "@/components/page-shell";

export const metadata = {
  title: "Scraper | FadeThat",
  description:
    "Submit track titles, match YouTube URLs, and prepare zipped downloads through the FadeThat scraper flow.",
};

export default function ScraperPage() {
  return (
    <div className="page-scraper">
      <PageShell>
        <section className="intro">
          <div className="panel">
            <p className="eyebrow">Track Intake</p>
            <h1>Scraper</h1>
            <p className="subtle">
              Paste titles in the same one-title-per-line format as <code>input_tracks.csv</code>,
              provide a YouTube API key, and submit them to a temporary backend route that will
              later run <code>scrape_tracks.py</code>.
            </p>
            <div className="button-row">
              <a
                className="button-link secondary"
                href="https://console.cloud.google.com/apis"
                target="_blank"
                rel="noreferrer"
              >
                Open Google Cloud APIs
              </a>
            </div>
          </div>

          <aside className="panel">
            <p className="eyebrow">Backend Plan</p>
            <h2>What the browser should do</h2>
            <p className="subtle">
              Keep browser automation off the client. The page should call your server, and your
              server should run Playwright headlessly in a worker or job queue, then stream back
              job status and the final zip file.
            </p>
            <ul className="mini-list">
              <li>
                <strong>Step 1:</strong> <code>POST /api/scrape</code> with titles and API key.
              </li>
              <li>
                <strong>Step 2:</strong> review and submit checked URLs to <code>POST /api/download</code>.
              </li>
              <li>
                <strong>Step 3:</strong> backend returns a zip URL for download.
              </li>
            </ul>
          </aside>
        </section>

        <ScraperWorkflow />
      </PageShell>
    </div>
  );
}
