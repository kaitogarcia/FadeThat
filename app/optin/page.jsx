import PageShell from "@/components/page-shell";
import OptinForm from "@/components/optin-form";

export const metadata = {
  title: "sms optin | FadeThat",
  description: "FadeThat SMS opt-in form",
};

export default function OptinPage() {
  return (
    <div className="page-optin">
      <PageShell>
        <main className="card">
          <h1>sms optin</h1>

          <section className="copy" aria-label="SMS terms">
            <p>
              FadeThat uses SMS messaging to send OTP for account verification and service-related
              notifications.
            </p>
            <p>
              Users are presented with a clear and optional choice to receive SMS messages. SMS
              consent is collected through a dedicated opt-in mechanism on our website
              (https://fadethat.life/optin).
            </p>
            <p>Opt-in is not required to use the service.</p>
            <p>
              Message frequency varies depending on user activity. Messages are not used for
              marketing or promotional purposes.
            </p>
            <p>Users can reply STOP at any time to opt out.</p>
          </section>

          <OptinForm />
        </main>
      </PageShell>
    </div>
  );
}
