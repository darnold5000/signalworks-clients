import { notFound } from "next/navigation";
import { AdminClientHeader } from "@/components/admin/admin-client-header";
import { AdminClientNav } from "@/components/admin/admin-client-nav";
import { DeleteClientPanel } from "@/components/admin/delete-client-panel";
import { getAdminClientBundle } from "@/lib/admin/client-records";

export default async function AdminClientLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const bundle = await getAdminClientBundle(tenantId);
  if (!bundle) notFound();

  const { client, profile, platformCategory } = bundle;

  return (
    <div>
      <AdminClientHeader bundle={bundle} />
      <AdminClientNav tenantId={tenantId} />
      {children}
      <div id="delete-client" className="mt-10 scroll-mt-8 border-t border-border pt-8">
        <DeleteClientPanel
          tenantId={tenantId}
          slug={client.slug}
          displayName={profile?.display_name ?? client.business_name}
          platformCategory={platformCategory}
        />
      </div>
    </div>
  );
}
