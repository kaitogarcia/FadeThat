import localFont from "next/font/local";
import PageShell from "@/components/page-shell";
import GoalMatrices from "@/components/goal-matrices";
import goalsData from "@/data/goals.json";

// Display face for /goals. Arimo (SIL OFL) stands in for ABC Areal, Dinamo's Arial revival:
// to swap in Areal, point `src` at the licensed Areal woff2 file(s). `--g-font` picks it up.
const goalsFont = localFont({
  src: "../fonts/Arimo-Variable-latin.woff2",
  variable: "--font-goals",
  weight: "400 700",
  display: "swap",
});

export const metadata = {
  title: "Goals | FadeThat",
  description: "Editable goal matrices.",
};

export default function GoalsPage() {
  return (
    <div className={`page-goals ${goalsFont.variable}`}>
      <PageShell>
        <GoalMatrices initialData={goalsData} />
      </PageShell>
    </div>
  );
}
