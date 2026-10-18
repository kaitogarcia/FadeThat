import PageShell from "@/components/page-shell";
import GoalMatrices from "@/components/goal-matrices";

export const metadata = {
  title: "Goals | FadeThat",
  description: "Editable goal matrices.",
};

export default function GoalsPage() {
  return (
    <div className="page-goals">
      <PageShell>
        <GoalMatrices />
      </PageShell>
    </div>
  );
}
