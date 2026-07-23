import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader, Panel } from "@/components/ui";
import { getCurrentProfile } from "@/lib/auth";
import { getPrimaryClient } from "@/lib/data";
import {
  formatLegalEffectiveDate,
  renderSignalWorksTosHtml,
} from "@/lib/legal/signal-works-tos";
import { getActiveOfferForTenant, getLegalDocument } from "@/lib/offers/queries";

export default async function TermsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const client = await getPrimaryClient();
  if (!client) redirect("/no-access");

  const offer = await getActiveOfferForTenant(client.id);
  const termsDocument =
    offer?.terms_document_id
      ? await getLegalDocument(offer.terms_document_id)
      : null;

  const effectiveDate = formatLegalEffectiveDate();
  const contentHtml = renderSignalWorksTosHtml(effectiveDate);

  return (
    <>
      <PageHeader
        title="Terms of Service"
        description="Signal Works Terms of Service for your client account."
      />
      <Panel>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">
            Effective date when you accept: <strong>{effectiveDate}</strong>
          </p>
          <a
            href="/api/portal/legal/terms?download=1"
            className="text-sm font-medium underline underline-offset-2"
          >
            Download
          </a>
        </div>
        <div
          className="prose prose-sm max-w-none text-sm"
          dangerouslySetInnerHTML={{
            __html: termsDocument?.content_html ?? contentHtml,
          }}
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
