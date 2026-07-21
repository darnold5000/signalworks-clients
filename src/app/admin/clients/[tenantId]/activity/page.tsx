import { notFound } from "next/navigation";
import { ActivityTimeline } from "@/components/admin/activity-timeline";
import { getAdminClientBundle } from "@/lib/admin/client-records";

export default async function AdminClientActivityPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const bundle = await getAdminClientBundle(tenantId);
  if (!bundle) notFound();

  return <ActivityTimeline entries={bundle.activity} />;
}
