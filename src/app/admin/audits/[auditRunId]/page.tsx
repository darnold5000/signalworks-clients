import { notFound } from "next/navigation";
import { AuditDetailClient } from "@/components/admin/audits/audit-detail-client";
import { getAdminAuditRunDetail } from "@/lib/audit/admin/queries";

export default async function AdminAuditDetailPage({
  params,
}: {
  params: Promise<{ auditRunId: string }>;
}) {
  const { auditRunId } = await params;
  const detail = await getAdminAuditRunDetail(auditRunId);
  if (!detail) notFound();

  return <AuditDetailClient detail={detail} />;
}
