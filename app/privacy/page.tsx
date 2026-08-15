import type { Metadata } from "next";
import Link from "next/link";
import { CinematicCurtain } from "@/components/cinematic-curtain";

export const metadata: Metadata = {
  title: "Privacy Notice",
  description: "How Authentic Resell handles application and optional analytics data.",
  alternates: { canonical: "/privacy" }
};

export default function PrivacyPage() {
  return (
    <>
      <CinematicCurtain />
      <main className="legal-page">
        <Link className="legal-back" href="/">← Back to Authentic Resell</Link>
        <p className="section-eyebrow">Privacy and data use</p>
        <h1>Privacy notice</h1>
        <p className="legal-updated">Last updated August 15, 2026</p>

        <section>
          <h2>What this notice covers</h2>
          <p>
            This notice explains the information used to operate the Authentic Resell application funnel,
            review applications, arrange follow-up, and understand site performance.
          </p>
        </section>

        <section>
          <h2>Information collected</h2>
          <p>
            If you apply, the form collects your name, email, phone number, age range, experience, goals,
            available budget range, and call commitment. The service also records limited technical and
            attribution details such as timestamps, device type, referral source, and campaign parameters.
          </p>
        </section>

        <section>
          <h2>Optional analytics</h2>
          <p>
            Usage analytics are disabled until you choose to allow them. Analytics events are designed not to
            include your contact details or application answers. You can change this choice from the
            “Privacy choices” control on the main page.
          </p>
        </section>

        <section>
          <h2>How information is used and shared</h2>
          <p>
            Information is used to review and follow up on applications, provide scheduling, secure the site,
            and improve the application experience. It may be processed by the services that provide hosting,
            database storage, scheduling, analytics you consent to, and configured notifications. Those
            providers receive only the information needed for their role.
          </p>
        </section>

        <section>
          <h2>Retention, security, and your choices</h2>
          <p>
            Application records are retained while reasonably needed for review, follow-up, operational
            records, security, and applicable legal obligations. Reasonable safeguards are used, but no online
            system can promise absolute security. To ask about an application record, reply through the
            Authentic Resell contact channel used for your application. If you do not want the form details
            processed, do not submit the application.
          </p>
        </section>

        <section>
          <h2>Age</h2>
          <p>The public application is intended for people aged 18 or older.</p>
        </section>
      </main>
    </>
  );
}
