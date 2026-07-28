import { notFound } from "next/navigation";
import { DeleteClientPanel } from "@/components/admin/delete-client-panel";
import { getAdminClientBundle } from "@/lib/admin/client-records";

export default async function AdminClientSettingsPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const bundle = await getAdminClientBundle(tenantId);
  if (!bundle) notFound();

  const { client, profile, platformCategory } = bundle;

  return (
    <DeleteClientPanel
      tenantId={tenantId}
      slug={client.slug}
      displayName={profile?.display_name ?? client.business_name}
      platformCategory={platformCategory}
    />
  );
}
