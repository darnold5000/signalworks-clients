import { OfferPortal } from "@/components/portal/offer-portal";
import { PageHeader } from "@/components/ui";

export default function OfferPage() {
  return (
    <>
      <PageHeader
        title="Your proposal"
        description="Review your offer, confirm company details, accept terms, and complete checkout."
      />
      <OfferPortal />
    </>
  );
}
