import { notFound } from "next/navigation";
import { SystemHealthPanel } from "@/components/admin/system-health-panel";
import { getAdminClientBundle } from "@/lib/admin/client-records";
import { getTenantOperationsHealth } from "@/lib/client-health/uptimerobot/refresh";
import { createClient } from "@/lib/supabase/server";

export default async function AdminClientSystemHealthPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const bundle = await getAdminClientBundle(tenantId);
  if (!bundle) notFound();

  const supabase = await createClient();
  const { health, uptimerobot } = await getTenantOperationsHealth(
    tenantId,
    supabase,
  );

  const monitorId =
    bundle.technical?.uptime_robot_monitor_id?.trim() || null;

  return (
    <SystemHealthPanel
      tenantId={tenantId}
      initialHealth={health}
      initialUptimeRobot={uptimerobot}
      configuredMonitorId={monitorId}
    />
  );
}
