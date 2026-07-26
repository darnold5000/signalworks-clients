import { AdminClientDocumentUpload } from "@/components/admin/admin-client-document-upload";
import { PageHeader, Panel } from "@/components/ui";
import { listTenantDocuments } from "@/lib/documents/service";
import { isServiceRoleConfigured } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { notFound } from "next/navigation";

export default async function AdminClientDocumentsPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const canUpload = isServiceRoleConfigured();

  let documents: Awaited<ReturnType<typeof listTenantDocuments>> = [];
  if (canUpload) {
    try {
      documents = await listTenantDocuments(tenantId);
    } catch {
      notFound();
    }
  }

  return (
    <>
      <PageHeader
        title="Documents"
        description="Upload files that appear on this client's Documents tab in the portal."
      />

      {canUpload ? (
        <AdminClientDocumentUpload tenantId={tenantId} />
      ) : (
        <Panel className="mb-6">
          <p className="text-sm text-muted">
            Configure <code className="text-xs">SUPABASE_SERVICE_ROLE_KEY</code>{" "}
            to enable uploads.
          </p>
        </Panel>
      )}

      <Panel title="Uploaded files" className="mt-6">
        {documents.length === 0 ? (
          <p className="text-sm text-muted">No uploaded files yet.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {documents.map((doc) => (
              <li key={doc.id} className="flex justify-between gap-4 py-3">
                <div>
                  <p className="font-medium">{doc.title}</p>
                  {doc.description ? (
                    <p className="text-muted">{doc.description}</p>
                  ) : null}
                  <p className="text-xs text-muted">
                    {formatDate(doc.created_at)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
