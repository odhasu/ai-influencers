import type { Metadata } from "next";
import Link from "next/link";
import { CinematicCurtain } from "@/components/cinematic-curtain";

export const metadata: Metadata = {
  title: "Website Terms",
  description: "Terms for using the Authentic Resell application website.",
  alternates: { canonical: "/terms" }
};

export default function TermsPage() {
  return (
    <>
      <CinematicCurtain />
      <main className="legal-page">
        <Link className="legal-back" href="/">← Back to Authentic Resell</Link>
        <p className="section-eyebrow">Website terms</p>
        <h1>Terms of use</h1>
        <p className="legal-updated">Last updated August 15, 2026</p>

        <section>
          <h2>Application and eligibility</h2>
          <p>
            This website lets adults apply for an introductory conversation about the Inner Circle. Submitting
            an application or scheduling a call does not guarantee acceptance, availability, or enrollment.
            Any paid program will have its own scope, price, and agreement presented before purchase.
          </p>
        </section>

        <section>
          <h2>No earnings guarantee</h2>
          <p>
            Reselling and other business activity involve risk. Member stories and screenshots show individual
            experiences and are not promises of income, profit, or future performance. Your results depend on
            factors including your decisions, effort, experience, costs, and market conditions.
          </p>
        </section>

        <section>
          <h2>Website information</h2>
          <p>
            Website content is general educational and promotional information, not legal, tax, investment, or
            financial advice. Verify important information independently and seek qualified advice where needed.
          </p>
        </section>

        <section>
          <h2>Acceptable use</h2>
          <p>
            Do not misuse the form, attempt unauthorized access, interfere with the service, submit another
            person&apos;s details without permission, or use automated traffic to distort applications or analytics.
          </p>
        </section>

        <section>
          <h2>Third-party services and changes</h2>
          <p>
            Scheduling, video, hosting, and other features may rely on third-party services with their own
            terms. Website availability and content may change as the program and application process evolve.
          </p>
        </section>
      </main>
    </>
  );
}
