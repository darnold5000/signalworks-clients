import { calculateOfferTotals } from "@/lib/offers/calculate-totals";
import { validateOfferItemsForCustomerFacing } from "@/lib/offers/offer-item-validation";
import { ensureOfferSowDocument, ensurePlatformTermsDocument, getOfferWithItems } from "@/lib/offers/queries";
import { syncPublishedOfferCatalog } from "@/lib/offers/stripe-catalog";
import { createServiceClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/supabase/tables";

/** Finalize mutable proposal content immediately before its first delivery. */
export async function prepareOfferForSend(args: { tenantId: string; offerId: string; actorUserId: string | null }) {
  const offer = await getOfferWithItems(args.offerId);
  if (!offer || offer.tenant_id !== args.tenantId) throw new Error("Offer not found.");
  if (offer.status !== "draft") return offer;
  if (offer.items.length === 0) throw new Error("Add at least one line item before sending.");
  const validation = validateOfferItemsForCustomerFacing(offer.items);
  if (validation) throw new Error(validation);

  let termsDocumentId = offer.terms_document_id;
  if (offer.requires_terms_acceptance && !termsDocumentId) {
    termsDocumentId = (await ensurePlatformTermsDocument(args.actorUserId)).id;
  }
  await syncPublishedOfferCatalog(offer, offer.items);
  const refreshed = await getOfferWithItems(args.offerId);
  if (!refreshed) throw new Error("Offer not found.");

  const supabase = createServiceClient();
  const [{ data: profile }, { data: settings }] = await Promise.all([
    supabase.from(TABLES.tenantProfiles).select("legal_business_name, display_name, primary_contact_name, primary_contact_email, primary_contact_phone, website_url, primary_domain").eq("tenant_id", args.tenantId).maybeSingle(),
    supabase.from(TABLES.tenantPortalSettings).select("contract_start_on").eq("tenant_id", args.tenantId).maybeSingle(),
  ]);
  const businessName = String(profile?.legal_business_name ?? profile?.display_name ?? offer.title);
  const sow = await ensureOfferSowDocument({
    tenantId: args.tenantId,
    client: {
      businessName,
      contactName: String(profile?.primary_contact_name ?? businessName),
      email: String(profile?.primary_contact_email ?? ""),
      phone: (profile?.primary_contact_phone as string | null) ?? null,
      website: (profile?.website_url as string | null) ?? null,
      domain: (profile?.primary_domain as string | null) ?? null,
      planName: refreshed.items.find((item) => item.item_type === "base_plan")?.name ?? offer.title,
      projectStart: String(settings?.contract_start_on ?? new Date().toISOString().slice(0, 10)),
    },
    offer: { ...refreshed, ...calculateOfferTotals(refreshed.items) },
    items: refreshed.items,
    createdBy: args.actorUserId,
  });
  const { error } = await supabase.from(TABLES.clientOffers).update({
    terms_document_id: termsDocumentId,
    sow_document_id: sow.id,
    ...calculateOfferTotals(refreshed.items),
  }).eq("id", args.offerId).eq("status", "draft");
  if (error) throw new Error(error.message);
  return (await getOfferWithItems(args.offerId))!;
}
