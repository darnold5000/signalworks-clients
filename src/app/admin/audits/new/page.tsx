import { AuditNewForm } from "@/components/admin/audits/audit-new-form";
import { PageHeader } from "@/components/ui";
import { getAdminClientList } from "@/lib/admin/client-records";

export default async function AdminNewAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const initialTenantId =
    typeof params.tenantId === "string" ? params.tenantId : undefined;
  const initialUrl = typeof params.url === "string" ? params.url : undefined;

  const clients = await getAdminClientList();
  const tenants = clients.map((client) => ({
    id: client.id,
    name: client.business_name,
  }));

  return (
    <div>
      <PageHeader
        title="Run audit"
        description="Audits run synchronously in this request (up to 5 minutes). Client Health audits require a tenant and include Operations Inventory."
      />
      <AuditNewForm
        tenants={tenants}
        initialTenantId={initialTenantId}
        initialUrl={initialUrl}
      />
    </div>
  );
}
