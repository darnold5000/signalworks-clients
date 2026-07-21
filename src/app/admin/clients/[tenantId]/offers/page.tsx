import { OfferBuilder } from "@/components/admin/offer-builder";
import { PageHeader } from "@/components/ui";
import { listOffersForTenant } from "@/lib/offers/queries";
import { getAdminClientBundle } from "@/lib/admin/client-records";
import { notFound } from "next/navigation";

export default async function AdminClientOffersPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const bundle = await getAdminClientBundle(tenantId);
  if (!bundle) notFound();

  const offers = await listOffersForTenant(tenantId);

  return (
    <>
      <PageHeader
        title="Offers"
        description="Build, publish, and track client proposals and checkout."
      />
      <OfferBuilder tenantId={tenantId} initialOffers={offers} />
    </>
  );
}
