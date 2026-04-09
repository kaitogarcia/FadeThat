import Link from "next/link";
import PageShell from "@/components/page-shell";

const entries = [
  {
    date: "2026-04-09",
    title: "fade that style book",
    href: "/blog/stylebook",
  },
];

export const metadata = {
  title: "Blog | FadeThat",
  description: "FadeThat blog index.",
};

export default function BlogPage() {
  return (
    <div className="page-blog">
      <PageShell>
        <section className="blog-chart-wrap">
          <h1>blog</h1>

          <div className="blog-chart" role="table" aria-label="Blog entries">
            <div className="blog-chart-row blog-chart-head" role="row">
              <span role="columnheader">entry date |</span>
              <span role="columnheader">title |</span>
            </div>

            {entries.map((entry) => (
              <div className="blog-chart-row" role="row" key={entry.href}>
                <span role="cell">{entry.date} |</span>
                <Link role="cell" href={entry.href}>
                  {entry.title} |
                </Link>
              </div>
            ))}
          </div>
        </section>
      </PageShell>
    </div>
  );
}
