import Link from "next/link";
import { Suspense } from "react";
import { AuditListClient } from "@/components/admin/audits/audit-list-client";
import { ButtonLink, MetaRow, PageHeader, Panel } from "@/components/ui";
import { getAdminClientBundle } from "@/lib/admin/client-records";
import { getClientAuditSummary, listAdminAudits } from "@/lib/audit/admin/queries";
import { formatScoreChange } from "@/lib/audit/admin/labels";
import { notFound } from "next/navigation";

export default async function AdminClientAuditsPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const bundle = await getAdminClientBundle(tenantId);
  if (!bundle) notFound();

  const [summary, items] = await Promise.all([
    getClientAuditSummary(tenantId),
    listAdminAudits({ tenantId }),
  ]);

  const websiteUrl = bundle.client.website_url ?? bundle.profile?.website_url ?? null;
  const newAuditHref = `/admin/audits/new?tenantId=${tenantId}${
    websiteUrl ? `&url=${encodeURIComponent(websiteUrl)}` : ""
  }`;

  return (
    <div>
      <PageHeader
        title="Audit history"
        description={`Audits for ${bundle.profile?.display_name ?? bundle.client.business_name}`}
        actions={<ButtonLink href={newAuditHref}>Run audit</ButtonLink>}
      />

      <Panel title="Summary" className="mb-6">
        <dl>
          <MetaRow label="Latest score" value={summary.latestScore ?? "—"} />
          <MetaRow
            label="Change from previous"
            value={formatScoreChange(summary.scoreChange)}
          />
        </dl>
        {summary.latestRunId ? (
          <Link
            href={`/admin/audits/${summary.latestRunId}`}
            className="mt-3 inline-block text-sm text-accent hover:underline"
          >
            View latest audit
          </Link>
        ) : null}
      </Panel>

      <Suspense>
        <AuditListClient items={items} tenants={[]} embedded />
      </Suspense>
    </div>
  );
}
