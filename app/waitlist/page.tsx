import type { Metadata } from "next";
import { WaitlistFunnel } from "@/components/waitlist-funnel";
import { getPublicFunnelSettings } from "@/lib/funnel-settings";

export const metadata: Metadata = {
  title: "Inner Circle Application",
  description:
    "Apply to the Authentic Resell Inner Circle and choose a time to discuss your reselling goals.",
  alternates: { canonical: "/" }
};

export default async function WaitlistPage() {
  const settings = await getPublicFunnelSettings();
  return <WaitlistFunnel settings={settings} />;
}
