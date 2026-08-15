import { WaitlistFunnel } from "@/components/waitlist-funnel";
import { getPublicFunnelSettings } from "@/lib/funnel-settings";

export default async function HomePage() {
  const settings = await getPublicFunnelSettings();
  return <WaitlistFunnel settings={settings} />;
}
