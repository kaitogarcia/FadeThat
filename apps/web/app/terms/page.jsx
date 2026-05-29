import Link from "next/link";
import LegalShell from "@/components/legal-shell";

export const metadata = {
  title: "Terms and Conditions | FadeThat",
  description: "FadeThat Terms and Conditions",
};

export default function TermsPage() {
  return (
    <LegalShell className="page-legal page-terms">
      <h1>Terms and Conditions</h1>
      <p className="updated">
        <strong>Last Updated:</strong> March 2026
      </p>

      <section className="terms-optin-card" aria-label="SMS opt-in">
        <div>
          <p className="terms-optin-kicker">sms consent</p>
          <h2>Opt in to FadeThat messages</h2>
          <p>
            Review the SMS terms, then submit the opt-in form when you want to receive service
            messages from FadeThat.
          </p>
        </div>
        <Link href="/optin">open optin</Link>
      </section>

      <section className="notice">
        <strong>SMS Communications Terms</strong>
        <p>
          By providing your phone number and opting in to receive text messages from FadeThat, you
          agree to receive recurring SMS or MMS messages from us related to our services, including
          account alerts, verification messages, reminders, support updates, and other
          communications you have consented to receive.
        </p>
        <p>
          Message frequency may vary. Message and data rates may apply. Reply
          <strong> STOP</strong> to unsubscribe at any time. Reply <strong>HELP</strong> for
          assistance.
        </p>
      </section>

      <p>
        These Terms and Conditions (<strong>Terms</strong>) govern your access to and use of the
        FadeThat website, products, services, and communications, including any SMS or MMS
        messaging programs operated by FadeThat (<strong>FadeThat</strong>, <strong>we</strong>,
        <strong> us</strong>, or <strong>our</strong>). By accessing or using our website or
        services, you agree to be bound by these Terms. If you do not agree, do not use our website
        or services.
      </p>

      <h2>1. Eligibility and Acceptance</h2>
      <p>
        You represent that you are at least 18 years old, or the age of majority in your
        jurisdiction, and have the legal capacity to enter into these Terms. If you are using our
        services on behalf of an organization, you represent that you have authority to bind that
        organization to these Terms.
      </p>

      <h2>2. Use of the Website and Services</h2>
      <p>You agree to use FadeThat only for lawful purposes and in accordance with these Terms. You must not:</p>
      <ul>
        <li>use the website or services in violation of any law or regulation;</li>
        <li>attempt to gain unauthorized access to any system, data, or account;</li>
        <li>interfere with the operation, security, or integrity of the website or services;</li>
        <li>submit false, misleading, or fraudulent information; or</li>
        <li>use the services in a manner that infringes the rights of FadeThat or others.</li>
      </ul>

      <h2>3. SMS Messaging Program Terms</h2>
      <p>If you opt in to receive SMS or MMS messages from FadeThat, the following additional terms apply:</p>
      <ul>
        <li>
          <strong>Consent to Receive Messages:</strong> By providing your mobile number and
          affirmatively opting in, you consent to receive text messages from FadeThat at the number
          provided.
        </li>
        <li>
          <strong>Message Types:</strong> Messages may include account notifications, one-time
          passwords, verification codes, reminders, customer care messages, service updates, or
          other messages described at the time of opt-in.
        </li>
        <li>
          <strong>Message Frequency:</strong> Message frequency may vary depending on your
          interaction with FadeThat.
        </li>
        <li>
          <strong>Carrier Charges:</strong> Message and data rates may apply according to your
          wireless carrier plan.
        </li>
        <li>
          <strong>Opt-Out:</strong> You can cancel SMS communications at any time by replying
          <strong> STOP</strong> to any text message we send you.
        </li>
        <li>
          <strong>Help:</strong> For help, reply <strong>HELP</strong> or contact us using the
          contact information listed below.
        </li>
        <li>
          <strong>Supported Carriers:</strong> Delivery is subject to effective transmission from
          your wireless carrier. Carriers are not liable for delayed or undelivered messages.
        </li>
      </ul>

      <h2>4. Consent Standards</h2>
      <p>
        By opting in, you acknowledge that your consent applies only to the communications
        described when you signed up. Consent to receive text messages is not a condition of
        purchase unless explicitly disclosed. You agree to provide a valid mobile number that you
        are authorized to use, and to promptly notify us if your number changes or is reassigned.
      </p>

      <h2>5. Account and Submission Accuracy</h2>
      <p>
        You agree that any information you provide to FadeThat, including your mobile number and
        contact details, will be truthful, current, and complete. You are responsible for
        maintaining the accuracy of your information.
      </p>

      <h2>6. Intellectual Property</h2>
      <p>
        All content on the FadeThat website, including text, graphics, logos, designs, software,
        and other materials, is owned by FadeThat or its licensors and is protected by applicable
        intellectual property laws. You may not reproduce, distribute, modify, or create derivative
        works from our content without prior written permission, except as permitted by law.
      </p>

      <h2>7. Privacy</h2>
      <p>
        Your use of FadeThat is also subject to our Privacy Policy, which explains how we collect,
        use, and protect your information. By using our website or services, you acknowledge that
        you have reviewed our Privacy Policy.
      </p>

      <h2>8. Service Availability</h2>
      <p>
        We may modify, suspend, or discontinue any part of our website or services at any time,
        with or without notice. We do not guarantee that the website or services will always be
        available, secure, or error-free.
      </p>

      <h2>9. Disclaimer of Warranties</h2>
      <p>
        To the maximum extent permitted by law, FadeThat provides its website and services on an as
        is and as available basis, without warranties of any kind, whether express, implied, or
        statutory, including any implied warranties of merchantability, fitness for a particular
        purpose, title, and non-infringement.
      </p>

      <h2>10. Limitation of Liability</h2>
      <p>
        To the fullest extent permitted by law, FadeThat will not be liable for any indirect,
        incidental, special, consequential, or punitive damages, or for any loss of profits,
        revenues, data, goodwill, or other intangible losses arising out of or related to your use
        of, or inability to use, the website, services, or messaging program.
      </p>

      <p>
        To the fullest extent permitted by law, FadeThat’s total liability for any claim arising
        out of or relating to these Terms or the website or services will not exceed the amount you
        paid to FadeThat, if any, in the twelve months preceding the event giving rise to the
        claim.
      </p>

      <h2>11. Indemnification</h2>
      <p>
        You agree to defend, indemnify, and hold harmless FadeThat and its affiliates, service
        providers, and representatives from and against any claims, liabilities, damages, losses,
        and expenses, including reasonable attorneys’ fees, arising out of or related to your
        violation of these Terms or your misuse of the website or services.
      </p>

      <h2>12. Termination</h2>
      <p>
        We may suspend or terminate your access to the website, services, or messaging program at
        any time, with or without notice, if we believe you have violated these Terms, applicable
        law, or our policies.
      </p>

      <h2>13. Governing Law</h2>
      <p>
        These Terms are governed by and construed in accordance with the laws of the State of [Your
        State], without regard to its conflict of laws principles.
      </p>

      <h2>14. Changes to These Terms</h2>
      <p>
        We may update these Terms from time to time. If we do, we will post the revised Terms on
        this page and update the Last Updated date above. Your continued use of the website or
        services after updated Terms are posted constitutes your acceptance of those changes.
      </p>

      <h2>15. Contact Information</h2>
      <p>If you have questions about these Terms or our communications practices, please contact us at:</p>
      <p>
        <strong>FadeThat</strong>
        <br />
        Email: <a href="mailto:help@fadethat.life">help@fadethat.life</a>
        <br />
        Website: <a href="https://fadethat.life">https://fadethat.life</a>
        <br />
        Mailing Address: 640 Laguna St. San Francisco CA
      </p>
    </LegalShell>
  );
}
