import { WaitlistFunnel } from "@/components/waitlist-funnel";
import { getFunnelSettings } from "@/lib/funnel-settings";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const settings = await getFunnelSettings();
  return <WaitlistFunnel settings={settings} />;
}
