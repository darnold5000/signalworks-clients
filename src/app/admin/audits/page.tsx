import { Suspense } from "react";
import { AuditListClient } from "@/components/admin/audits/audit-list-client";
import { getAdminClientList } from "@/lib/admin/client-records";
import { listAdminAudits } from "@/lib/audit/admin/queries";

export default async function AdminAuditsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const tenantId = typeof params.tenantId === "string" ? params.tenantId : undefined;
  const auditType =
    typeof params.auditType === "string" ? params.auditType : undefined;
  const status = typeof params.status === "string" ? params.status : undefined;
  const needsAttention = params.needsAttention === "1";
  const minScore =
    typeof params.minScore === "string" && params.minScore
      ? Number(params.minScore)
      : undefined;
  const maxScore =
    typeof params.maxScore === "string" && params.maxScore
      ? Number(params.maxScore)
      : undefined;
  const dateFrom =
    typeof params.dateFrom === "string" ? params.dateFrom : undefined;
  const dateTo = typeof params.dateTo === "string" ? params.dateTo : undefined;

  const [items, clients] = await Promise.all([
    listAdminAudits({
      tenantId,
      auditType,
      status,
      needsAttention: needsAttention || undefined,
      minScore,
      maxScore,
      dateFrom,
      dateTo,
    }),
    getAdminClientList(),
  ]);

  const tenants = clients.map((client) => ({
    id: client.id,
    name: client.business_name,
  }));

  return (
    <Suspense>
      <AuditListClient items={items} tenants={tenants} />
    </Suspense>
  );
}
