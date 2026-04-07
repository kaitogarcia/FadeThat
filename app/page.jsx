import PageShell from "@/components/page-shell";
import HomeHtmlClass from "@/components/home-html-class";
import SocialLinks from "@/components/social-links";

export const metadata = {
  title: "FadeThat",
  description: "FadeThat home page",
};

export default function HomePage() {
  return (
    <div className="infinite">
      <HomeHtmlClass />
      <PageShell>
        <main className="hero">
          <h1>fade that</h1>
          <SocialLinks />
          <p className="lede">welcome</p>

          <div className="note">
            [ NOTICE ]
            <br />
            Send <strong>zbarrons1@gmail.com</strong> a photo to trigger the Instagram post agent.
            Please use no subject line.
          </div>
        </main>
      </PageShell>
    </div>
  );
}
