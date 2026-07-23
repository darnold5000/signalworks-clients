import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader, Panel } from "@/components/ui";
import { getCurrentProfile } from "@/lib/auth";
import { getPrimaryClient } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/supabase/tables";
import { formatDateTime } from "@/lib/utils";

export default async function AcceptedDocumentPage({
  params,
}: {
  params: Promise<{ acceptanceId: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const client = await getPrimaryClient();
  if (!client) redirect("/no-access");

  const { acceptanceId } = await params;
  const supabase = await createClient();
  const { data: acceptance } = await supabase
    .from(TABLES.agreementAcceptances)
    .select(
      "id, tenant_id, accepted_name, accepted_email, accepted_at, document_snapshot_html, legal_document:legal_documents(title)",
    )
    .eq("id", acceptanceId)
    .eq("tenant_id", client.id)
    .maybeSingle();

  if (!acceptance) notFound();

  const title =
    (acceptance.legal_document as { title?: string } | null)?.title ??
    "Signed agreement";

  return (
    <>
      <PageHeader
        title={title}
        description={`Accepted by ${acceptance.accepted_name as string} on ${formatDateTime(acceptance.accepted_at as string)}`}
      />
      <Panel>
        <div className="mb-4 flex justify-end">
          <a
            href={`/api/portal/documents/accepted/${acceptanceId}?download=1`}
            className="text-sm font-medium underline underline-offset-2"
          >
            Download
          </a>
        </div>
        <div
          className="prose prose-sm max-w-none text-sm"
          dangerouslySetInnerHTML={{
            __html: acceptance.document_snapshot_html as string,
          }}
        />
        <p className="mt-6 text-sm text-muted">
          Signed as {acceptance.accepted_email as string}
        </p>
        <p className="mt-4 text-sm">
          <Link href="/documents" className="underline underline-offset-2">
            Back to documents
          </Link>
        </p>
      </Panel>
    </>
  );
}
