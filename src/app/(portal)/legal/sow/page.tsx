import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader, Panel } from "@/components/ui";
import { getCurrentProfile } from "@/lib/auth";
import { getPrimaryClient } from "@/lib/data";
import { getActiveOfferForTenant, getLegalDocument } from "@/lib/offers/queries";

export default async function SowPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const client = await getPrimaryClient();
  if (!client) redirect("/no-access");

  const offer = await getActiveOfferForTenant(client.id);
  if (!offer?.sow_document_id) {
    return (
      <>
        <PageHeader
          title="Statement of Work"
          description="Proposal scope and pricing for your engagement."
        />
        <Panel>
          <p className="text-sm text-muted">
            No Statement of Work is available for your account yet.
          </p>
          <p className="mt-4 text-sm">
            <Link href="/offer" className="underline underline-offset-2">
              Back to proposal
            </Link>
          </p>
        </Panel>
      </>
    );
  }

  const sow = await getLegalDocument(offer.sow_document_id);
  if (!sow) notFound();

  return (
    <>
      <PageHeader
        title="Statement of Work"
        description="Proposal scope and pricing for your engagement."
      />
      <Panel>
        <div className="mb-4 flex justify-end">
          <a
            href="/api/portal/legal/sow?download=1"
            className="text-sm font-medium underline underline-offset-2"
          >
            Download
          </a>
        </div>
        <div
          className="prose prose-sm max-w-none text-sm"
          dangerouslySetInnerHTML={{ __html: sow.content_html }}
        />
        <p className="mt-6 text-sm">
          <Link href="/offer" className="underline underline-offset-2">
            Back to proposal
          </Link>
        </p>
      </Panel>
    </>
  );
}
