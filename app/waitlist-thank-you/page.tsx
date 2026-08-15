import type { Metadata } from "next";
import { CalendarCheck2, Check, Eye, MessageCircle, PlayCircle } from "lucide-react";
import { OverviewVideo } from "@/components/overview-video";
import { CinematicCurtain } from "@/components/cinematic-curtain";
import { getPublicFunnelSettings } from "@/lib/funnel-settings";

export const metadata: Metadata = {
  title: "Application Received",
  description: "Your Inner Circle waitlist application has been received."
};

const nextSteps = [
  {
    icon: Eye,
    title: "Watch for a follow-up",
    body: "We may contact you using the details in your application. Keep an eye on your inbox and phone for the next step."
  },
  {
    icon: MessageCircle,
    title: "Review the details",
    body: "Read any follow-up carefully and ask questions before making a decision. There is no guaranteed income or business outcome."
  },
  {
    icon: PlayCircle,
    title: "Watch the overview",
    body: "Use this optional overview to prepare questions about the program and application process.",
    video: true
  }
] as const;

export default async function WaitlistThankYouPage() {
  const settings = await getPublicFunnelSettings();

  return (
    <>
      <CinematicCurtain />
      <main className="thank-you-page">
        <section className="thank-you-hero" aria-labelledby="thank-you-title">
          <div className="waitlist-badge">
            <Check size={16} strokeWidth={3} aria-hidden="true" />
            <span>You&apos;re on the Waitlist!</span>
          </div>
          <h1 id="thank-you-title" className="gradient-title thank-you-title">
            You Just Applied to the Waitlist
          </h1>
          <p className="thank-you-copy">
            Your application has been received. Review the next steps below and choose a call time if scheduling is available.
          </p>
        </section>

        <section className="important-callout" aria-labelledby="important-title">
          <CalendarCheck2 size={25} aria-hidden="true" />
          <div>
            <h2 id="important-title">What happens next</h2>
            <p>
              We&apos;ll use the contact details you supplied to follow up about your application. You can ask questions before deciding whether to continue.
            </p>
          </div>
        </section>

        <section className="next-steps" aria-label="What happens next">
          {nextSteps.map((item, index) => {
            const Icon = item.icon;
            return (
              <article className="next-step-card" key={item.title}>
                <div className="next-step-number">{index + 1}</div>
                <div className="next-step-icon" aria-hidden="true">
                  <Icon size={24} />
                </div>
                <div className="next-step-content">
                  <span className="next-step-kicker">Step {index + 1} of 3</span>
                  <h2>{item.title}</h2>
                  <p>{item.body}</p>
                  {"video" in item ? <OverviewVideo streamUrl={settings.thankYouVideoUrl} /> : null}
                </div>
              </article>
            );
          })}
        </section>

        {settings.bookingUrl ? (
          <div className="thank-you-booking">
            <a
              className="cta-button"
              href={settings.bookingUrl}
              rel="noreferrer"
              data-analytics-event="booking_started"
              data-analytics-label={settings.bookingCtaLabel}
              data-analytics-location="thank_you_page"
            >
              {settings.bookingCtaLabel}
            </a>
          </div>
        ) : null}
      </main>
    </>
  );
}
