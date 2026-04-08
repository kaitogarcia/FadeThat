import InstagramManager from "@/components/instagram-manager";
import PageShell from "@/components/page-shell";

export const metadata = {
  title: "Manage Instagram | FadeThat",
  description: "Connect a Graph API token and run the FadeThat Instagram manager.",
};

export default function InstagramPage() {
  return (
    <div className="page-instagram">
      <PageShell>
        <InstagramManager />
      </PageShell>
    </div>
  );
}
