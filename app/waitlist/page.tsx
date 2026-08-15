import type { Metadata } from "next";
import { WaitlistFunnel } from "@/components/waitlist-funnel";
import { getFunnelSettings } from "@/lib/funnel-settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Lucas Resells | Apply for the Inner Circle",
  description: "Apply to build your high-ticket reselling business with the Inner Circle."
};

export default async function WaitlistPage() {
  const settings = await getFunnelSettings();
  return <WaitlistFunnel settings={settings} />;
}
