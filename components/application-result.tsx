import { Check } from "lucide-react";
import { CinematicCurtain } from "@/components/cinematic-curtain";
import { DiscordButton } from "@/components/discord-button";

export function ApplicationResult({ message }: { message: string }) {
  return (
    <>
      <CinematicCurtain />
      <main className="application-result-page">
        <section className="application-result-card" aria-labelledby="application-result-title">
          <span className="application-result-icon" aria-hidden="true">
            <Check size={30} strokeWidth={2.5} />
          </span>
          <p className="application-result-kicker">Application status</p>
          <h1 id="application-result-title">Application Received</h1>
          <p className="application-result-message">{message}</p>
          <div className="button-wrap discord-wrap">
            <DiscordButton />
          </div>
        </section>
      </main>
    </>
  );
}
