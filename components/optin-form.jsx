"use client";

import { useRef, useState } from "react";

const STORAGE_KEY = "fadethat_optin_submissions";

export default function OptinForm() {
  const formRef = useRef(null);
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [bannerMessage, setBannerMessage] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();

    const form = formRef.current;
    if (!form) {
      return;
    }

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const submission = {
      email: email.trim(),
      consent: true,
      source: "/optin",
      submittedAt: new Date().toISOString(),
    };

    try {
      const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      existing.push(submission);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
    } catch (error) {
      console.error("Unable to store opt-in submission", error);
    }

    setBannerMessage("Success. Your opt-in has been recorded.");
    setEmail("");
    setConsent(false);
  };

  return (
    <>
      <form id="optin-form" noValidate onSubmit={handleSubmit} ref={formRef}>
        <div className="field">
          <label htmlFor="email">email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <div className="checkbox-row">
          <input
            id="consent"
            name="consent"
            type="checkbox"
            required
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
          />
          <label htmlFor="consent">I agree to the SMS terms listed above.</label>
        </div>

        <button type="submit">submit</button>
      </form>

      <div
        id="success-banner"
        className={`banner${bannerMessage ? " show" : ""}`}
        role="status"
        aria-live="polite"
      >
        {bannerMessage}
      </div>
    </>
  );
}
