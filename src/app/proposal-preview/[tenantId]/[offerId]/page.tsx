import Link from "next/link";
import { notFound } from "next/navigation";
import { ProposalClientView } from "@/components/portal/proposal-client-view";
import { getAdminClientBundle } from "@/lib/admin/client-records";
import { requireAdmin } from "@/lib/auth";
import { getOfferWithItems } from "@/lib/offers/queries";

export default async function ProposalPreviewPage({
  params,
}: {
  params: Promise<{ tenantId: string; offerId: string }>;
}) {
  await requireAdmin();
  const { tenantId, offerId } = await params;
  const [offer, bundle] = await Promise.all([
    getOfferWithItems(offerId),
    getAdminClientBundle(tenantId),
  ]);
  if (
    !offer ||
    !bundle ||
    offer.tenant_id !== tenantId ||
    offer.status !== "draft"
  ) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-background px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="sticky top-3 z-10 mb-5 flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold tracking-wide uppercase">
              Preview mode
            </p>
            <p className="text-sm">
              This proposal has not been published. This is how the client will
              see it.
            </p>
          </div>
          <Link
            href={`/admin/clients/${tenantId}/offers`}
            className="text-sm font-semibold underline underline-offset-2"
          >
            Return to Proposal Editor
          </Link>
        </div>
        <ProposalClientView
          offer={offer}
          items={offer.items}
          features={offer.features}
          planInclusions={bundle.client.plan_inclusions}
          setupInclusions={bundle.client.setup_inclusions}
          preview
        />
      </div>
    </main>
  );
}
