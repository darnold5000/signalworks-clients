import type {
  ClientOffer,
  ClientOfferItem,
  ClientOfferFeature,
  LegalDocument,
  ProposalRecipient,
} from "@/lib/database/phase1-types";
import {
  renderOfferSowHtml,
  renderOfferSowText,
  type SowClientContext,
} from "@/lib/legal/offer-sow";
import {
  renderSignalWorksTosHtml,
  renderSignalWorksTosText,
} from "@/lib/legal/signal-works-tos";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/supabase/tables";

export type OfferWithItems = ClientOffer & {
  items: ClientOfferItem[];
  features: ClientOfferFeature[];
};

export async function listProposalRecipientsForTenant(tenantId: string): Promise<ProposalRecipient[]> {
  const supabase = await createClient();
  const { data } = await supabase.from(TABLES.proposalRecipients).select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false });
  return (data as ProposalRecipient[]) ?? [];
}

export async function listOffersForTenant(
  tenantId: string,
): Promise<OfferWithItems[]> {
  const supabase = await createClient();
  const { data: offers } = await supabase
    .from(TABLES.clientOffers)
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (!offers?.length) return [];

  const offerIds = offers.map((o) => o.id as string);
  const { data: items } = await supabase
    .from(TABLES.clientOfferItems)
    .select("*")
    .in("offer_id", offerIds)
    .order("sort_order", { ascending: true });

  const itemsByOffer = new Map<string, ClientOfferItem[]>();
  for (const item of items ?? []) {
    const offerId = item.offer_id as string;
    const list = itemsByOffer.get(offerId) ?? [];
    list.push(item as ClientOfferItem);
    itemsByOffer.set(offerId, list);
  }

  const { data: features } = await supabase
    .from(TABLES.clientOfferFeatures)
    .select("*")
    .in("offer_id", offerIds)
    .order("sort_order", { ascending: true });
  const featuresByOffer = new Map<string, ClientOfferFeature[]>();
  for (const feature of features ?? []) {
    const offerId = feature.offer_id as string;
    const list = featuresByOffer.get(offerId) ?? [];
    list.push(feature as ClientOfferFeature);
    featuresByOffer.set(offerId, list);
  }

  return offers.map((offer) => ({
    ...(offer as ClientOffer),
    items: itemsByOffer.get(offer.id as string) ?? [],
    features: featuresByOffer.get(offer.id as string) ?? [],
  }));
}

export async function getOfferWithItems(
  offerId: string,
): Promise<OfferWithItems | null> {
  const supabase = await createClient();
  const { data: offer } = await supabase
    .from(TABLES.clientOffers)
    .select("*")
    .eq("id", offerId)
    .maybeSingle();

  if (!offer) return null;

  const { data: items } = await supabase
    .from(TABLES.clientOfferItems)
    .select("*")
    .eq("offer_id", offerId)
    .order("sort_order", { ascending: true });

  const { data: features } = await supabase
    .from(TABLES.clientOfferFeatures)
    .select("*")
    .eq("offer_id", offerId)
    .order("sort_order", { ascending: true });

  return {
    ...(offer as ClientOffer),
    items: (items as ClientOfferItem[]) ?? [],
    features: (features as ClientOfferFeature[]) ?? [],
  };
}

export async function getActiveOfferForTenant(
  tenantId: string,
): Promise<OfferWithItems | null> {
  const supabase = await createClient();
  const { data: offers } = await supabase
    .from(TABLES.clientOffers)
    .select("*")
    .eq("tenant_id", tenantId)
    .in("status", [
      "published",
      "viewed",
      "accepted",
      "checkout_started",
    ])
    .order("published_at", { ascending: false })
    .limit(1);

  const offer = offers?.[0];
  if (!offer) return null;
  return getOfferWithItems(offer.id as string);
}

/** Active pre-purchase offer, else latest purchased offer, else tenant SOW legal doc. */
export async function resolveTenantSowDocumentId(
  tenantId: string,
): Promise<string | null> {
  const active = await getActiveOfferForTenant(tenantId);
  if (active?.sow_document_id) return active.sow_document_id;

  const supabase = await createClient();
  const { data: purchasedOffer } = await supabase
    .from(TABLES.clientOffers)
    .select("sow_document_id")
    .eq("tenant_id", tenantId)
    .eq("status", "purchased")
    .order("purchased_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (purchasedOffer?.sow_document_id) {
    return purchasedOffer.sow_document_id as string;
  }

  const { data: legal } = await supabase
    .from(TABLES.legalDocuments)
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("document_type", "statement_of_work")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (legal?.id as string | undefined) ?? null;
}

export async function getLegalDocument(
  documentId: string,
): Promise<LegalDocument | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from(TABLES.legalDocuments)
    .select("*")
    .eq("id", documentId)
    .maybeSingle();
  return (data as LegalDocument | null) ?? null;
}

export async function ensurePlatformTermsDocument(
  createdBy?: string | null,
): Promise<LegalDocument> {
  const supabase = createServiceClient();
  const version = "2.0";
  const contentHtml = renderSignalWorksTosHtml();
  const contentText = renderSignalWorksTosText();

  const { data: existing } = await supabase
    .from(TABLES.legalDocuments)
    .select("*")
    .is("tenant_id", null)
    .eq("document_type", "terms_of_service")
    .eq("version", version)
    .eq("active", true)
    .maybeSingle();

  if (existing) return existing as LegalDocument;

  await supabase
    .from(TABLES.legalDocuments)
    .update({ active: false })
    .is("tenant_id", null)
    .eq("document_type", "terms_of_service")
    .eq("active", true);

  const { data: created, error } = await supabase
    .from(TABLES.legalDocuments)
    .insert({
      tenant_id: null,
      document_type: "terms_of_service",
      title: "Signal Works Terms of Service",
      version,
      content_html: contentHtml,
      content_text: contentText,
      effective_date: new Date().toISOString().slice(0, 10),
      active: true,
      created_by: createdBy ?? null,
    })
    .select("*")
    .single();

  if (error || !created) {
    throw new Error(error?.message ?? "Could not create terms document");
  }

  return created as LegalDocument;
}

export async function ensureOfferSowDocument(args: {
  tenantId: string;
  client: SowClientContext;
  offer: ClientOffer;
  items: ClientOfferItem[];
  createdBy?: string | null;
}): Promise<LegalDocument> {
  const supabase = createServiceClient();
  const version = `offer-${args.offer.id.slice(0, 8)}`;
  const contentHtml = renderOfferSowHtml({
    client: args.client,
    offer: args.offer,
    items: args.items,
  });
  const contentText = renderOfferSowText({
    client: args.client,
    offer: args.offer,
    items: args.items,
  });

  const { data: existing } = await supabase
    .from(TABLES.legalDocuments)
    .select("*")
    .eq("tenant_id", args.tenantId)
    .eq("document_type", "statement_of_work")
    .eq("version", version)
    .maybeSingle();

  if (existing) {
    const { data: updated, error } = await supabase
      .from(TABLES.legalDocuments)
      .update({
        title: `Statement of Work — ${args.client.businessName}`,
        content_html: contentHtml,
        content_text: contentText,
        effective_date: new Date().toISOString().slice(0, 10),
        active: true,
      })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error || !updated) {
      throw new Error(error?.message ?? "Could not update SOW document");
    }
    return updated as LegalDocument;
  }

  const { data: created, error } = await supabase
    .from(TABLES.legalDocuments)
    .insert({
      tenant_id: args.tenantId,
      document_type: "statement_of_work",
      title: `Statement of Work — ${args.client.businessName}`,
      version,
      content_html: contentHtml,
      content_text: contentText,
      effective_date: new Date().toISOString().slice(0, 10),
      active: true,
      created_by: args.createdBy ?? null,
    })
    .select("*")
    .single();

  if (error || !created) {
    const detail = error?.message ?? "Could not create SOW document";
    if (
      detail.includes("legal_documents_platform_types_require_global_tenant") ||
      detail.includes("legal_documents_document_type_check")
    ) {
      throw new Error(
        "Database migration required for Statement of Work. Apply migrations 013 and 014 in Supabase, then retry.",
      );
    }
    if (detail.includes("sow_document_id")) {
      throw new Error(
        "Database migration required: apply migration 013 (sow_document_id on client_offers), then retry.",
      );
    }
    throw new Error(detail);
  }

  return created as LegalDocument;
}
