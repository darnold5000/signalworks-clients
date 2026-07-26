import Link from "next/link";
import { SowPrintActions } from "@/components/portal/sow-print-actions";
import { notFound, redirect } from "next/navigation";
import { PageHeader, Panel } from "@/components/ui";
import { getCurrentProfile } from "@/lib/auth";
import { getPrimaryClient } from "@/lib/data";
import {
  getLegalDocument,
  resolveTenantSowDocumentId,
} from "@/lib/offers/queries";

export default async function SowPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const client = await getPrimaryClient();
  if (!client) redirect("/no-access");

  const sowDocumentId = await resolveTenantSowDocumentId(client.id);
  if (!sowDocumentId) {
    return (
      <>
        <PageHeader
          title="Statement of Work"
          description="Scope and pricing for your engagement."
        />
        <Panel>
          <p className="text-sm text-muted">
            No Statement of Work is available for your account yet.
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

  const sow = await getLegalDocument(sowDocumentId);
  if (!sow) notFound();

  return (
    <>
      <PageHeader
        title="Statement of Work"
        description="Scope and pricing for your engagement."
      />
      <Panel>
        <SowPrintActions />
        <div
          className="sw-sow-container max-w-none text-sm print:max-w-none"
          dangerouslySetInnerHTML={{ __html: sow.content_html }}
        />
        <p className="mt-6 text-sm print:hidden">
          <Link href="/documents" className="underline underline-offset-2">
            Back to documents
          </Link>
          {" · "}
          <Link href="/billing" className="underline underline-offset-2">
            Billing
          </Link>
        </p>
      </Panel>
    </>
  );
}
