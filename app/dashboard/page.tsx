import { requireAdmin, isDevelopmentAdminBypass } from "@/lib/admin-auth";
import { getDashboardPayload } from "@/lib/dashboard-data";
import { DashboardClient } from "./dashboard-client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requireAdmin();
  const payload = await getDashboardPayload();
  return <DashboardClient initialPayload={payload} developmentBypass={isDevelopmentAdminBypass()} />;
}
