import PageShell from "@/components/page-shell";
import BoardCanvas from "@/components/board-canvas";

export const metadata = {
  title: "Board | FadeThat",
  description: "FadeThat sticky note board.",
};

export default function BoardPage() {
  return (
    <div className="page-board">
      <PageShell>
        <BoardCanvas />
      </PageShell>
    </div>
  );
}
