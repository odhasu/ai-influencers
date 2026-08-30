import type { Metadata } from "next";
import { AlertTriangle, Check, Eye, MessageCircle, PlayCircle } from "lucide-react";
import { OverviewVideo } from "@/components/overview-video";
import { CinematicCurtain } from "@/components/cinematic-curtain";
import { getFunnelSettings } from "@/lib/funnel-settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "You're on the Waitlist | OG Ecom",
  description: "Your Inner Circle waitlist application has been received."
};

const nextSteps = [
  {
    icon: Eye,
    title: "Watch for a Call or Text",
    body: "We may reach out by phone or text within the next couple of hours. Save our number and make sure your notifications are on so you don't miss the call."
  },
  {
    icon: MessageCircle,
    title: "Respond Right Away",
    body: "If you've been selected, respond as soon as you hear from us. Spots are limited and they'll go to the next applicant if we can't get a hold of you."
  },
  {
    icon: PlayCircle,
    title: "Watch This While You Wait",
    body: "While you wait, watch this overview so you're ready to move fast if you get the call.",
    video: true
  }
] as const;

export default async function WaitlistThankYouPage() {
  const settings = await getFunnelSettings();

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
            OG Ecom is only letting a select few applicants join the program early. Be on the lookout for a phone call or text within the next couple of hours - if you don&apos;t respond, you&apos;ll miss your opportunity.
          </p>
        </section>

        <section className="important-callout" aria-labelledby="important-title">
          <AlertTriangle size={25} aria-hidden="true" />
          <div>
            <h2 id="important-title">Important!</h2>
            <p>
              Keep your phone close and your notifications on. If we reach out and you don&apos;t respond, your spot will be given to someone else.
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
