import { NextResponse } from "next/server";
import { logTenantActivity } from "@/lib/activity/log-tenant-activity";
import { calculateOfferTotals } from "@/lib/offers/calculate-totals";
import {
  ensurePlatformTermsDocument,
  getOfferWithItems,
} from "@/lib/offers/queries";
import { syncAllOfferItemsToStripe } from "@/lib/offers/stripe-catalog";
import { getCurrentProfile, isPlatformAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/supabase/tables";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ tenantId: string; offerId: string }> },
) {
  const profile = await getCurrentProfile();
  if (!profile || !(await isPlatformAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tenantId, offerId } = await params;
  const offer = await getOfferWithItems(offerId);
  if (!offer || offer.tenant_id !== tenantId) {
    return NextResponse.json({ error: "Offer not found" }, { status: 404 });
  }

  if (offer.status !== "draft") {
    return NextResponse.json(
      { error: "Only draft offers can be published" },
      { status: 400 },
    );
  }

  if (offer.items.length === 0) {
    return NextResponse.json(
      { error: "Add at least one line item before publishing" },
      { status: 400 },
    );
  }

  const totals = calculateOfferTotals(offer.items);
  let termsDocumentId = offer.terms_document_id;

  if (offer.requires_terms_acceptance && !termsDocumentId) {
    const terms = await ensurePlatformTermsDocument(profile.id);
    termsDocumentId = terms.id;
  }

  await syncAllOfferItemsToStripe(offer, offer.items);
  const refreshed = await getOfferWithItems(offerId);
  if (!refreshed) {
    return NextResponse.json({ error: "Offer not found" }, { status: 404 });
  }

  const supabase = await createClient();
  await supabase
    .from(TABLES.clientOffers)
    .update({
      status: "published",
      published_at: new Date().toISOString(),
      terms_document_id: termsDocumentId,
      ...totals,
    })
    .eq("id", offerId);

  await supabase
    .from(TABLES.tenantProfiles)
    .update({
      internal_status: "awaiting_agreement",
      onboarding_status: "invited",
    })
    .eq("tenant_id", tenantId);

  await logTenantActivity({
    tenantId,
    actorUserId: profile.id,
    actorType: "admin",
    action: "offer.published",
    entityType: "client_offer",
    entityId: offerId,
    summary: `Published offer "${offer.title}"`,
  });

  const published = await getOfferWithItems(offerId);
  return NextResponse.json({ offer: published });
}
