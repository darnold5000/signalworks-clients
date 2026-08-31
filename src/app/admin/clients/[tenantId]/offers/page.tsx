import { OfferBuilder } from "@/components/admin/offer-builder";
import { PageHeader } from "@/components/ui";
import {
  getActivePlanTemplates,
  getActivePlatformComponents,
  getActiveServiceAddOns,
} from "@/lib/catalog/queries";
import { listOffersForTenant, listProposalRecipientsForTenant } from "@/lib/offers/queries";
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

  const [offers, recipients, plans, platformComponents, serviceAddOns] =
    await Promise.all([
      listOffersForTenant(tenantId),
      listProposalRecipientsForTenant(tenantId),
      getActivePlanTemplates(),
      getActivePlatformComponents(),
      getActiveServiceAddOns(),
    ]);

  return (
    <>
      <PageHeader
        title="Proposals"
        description="Build, publish, and track client proposals."
      />
      <OfferBuilder
        tenantId={tenantId}
        initialOffers={offers}
        contacts={bundle.contacts}
        recipientDeliveries={recipients}
        plans={plans}
        platformComponents={platformComponents}
        serviceAddOns={serviceAddOns}
      />
    </>
  );
}
