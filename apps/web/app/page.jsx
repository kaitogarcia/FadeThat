import PageShell from "@/components/page-shell";
import HomeHtmlClass from "@/components/home-html-class";
import SocialLinks from "@/components/social-links";
import { cookies } from "next/headers";
import { FRONT_AUTH_COOKIE, frontAuthToken, normalizeFrontAuthRedirect } from "@/lib/front-auth";

export const metadata = {
  title: "FadeThat",
  description: "FadeThat home page",
};

export const dynamic = "force-dynamic";

function FrontPasswordGate({ hasError, nextPath }) {
  return (
    <div className="infinite">
      <HomeHtmlClass />
      <PageShell showNav={false}>
        <main className="hero front-lock" aria-labelledby="front-lock-title">
          <h1 id="front-lock-title">fade that</h1>
          <p className="lede">password required</p>

          <form className="front-lock-form" action="/api/front-auth" method="post">
            <label htmlFor="front-password">Password</label>
            <input type="hidden" name="next" value={nextPath} />
            <div className="front-lock-row">
              <input
                id="front-password"
                name="password"
                type="password"
                autoComplete="current-password"
                autoFocus
                required
              />
              <button type="submit">enter</button>
            </div>
            {hasError ? <p className="front-lock-error">incorrect password</p> : null}
          </form>
        </main>
      </PageShell>
    </div>
  );
}

export default async function HomePage({ searchParams }) {
  const cookieStore = await cookies();
  const isAuthed = cookieStore.get(FRONT_AUTH_COOKIE)?.value === frontAuthToken();
  const resolvedSearchParams = await searchParams;
  const hasError = resolvedSearchParams?.front_error === "1";
  const nextPath = normalizeFrontAuthRedirect(resolvedSearchParams?.next || "/");

  if (!isAuthed) {
    return <FrontPasswordGate hasError={hasError} nextPath={nextPath} />;
  }

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
            Send zbarrons1@gmail.com a photo to trigger the Instagram post agent.
            Please use no subject line.
          </div>
        </main>
      </PageShell>
    </div>
  );
}
