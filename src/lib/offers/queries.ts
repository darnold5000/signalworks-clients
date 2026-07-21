import type {
  ClientOffer,
  ClientOfferItem,
  LegalDocument,
} from "@/lib/database/phase1-types";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/supabase/tables";

export type OfferWithItems = ClientOffer & { items: ClientOfferItem[] };

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

  return offers.map((offer) => ({
    ...(offer as ClientOffer),
    items: itemsByOffer.get(offer.id as string) ?? [],
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

  return {
    ...(offer as ClientOffer),
    items: (items as ClientOfferItem[]) ?? [],
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
  const { data: existing } = await supabase
    .from(TABLES.legalDocuments)
    .select("*")
    .is("tenant_id", null)
    .eq("document_type", "terms_of_service")
    .eq("active", true)
    .order("effective_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return existing as LegalDocument;

  const version = "1.0";
  const contentHtml = `
    <h1>Signal Works Terms of Service</h1>
    <p>By accepting these terms, you agree to the website services, hosting, and support described in your proposal.</p>
    <p>Monthly services renew automatically until canceled through the client portal or in writing.</p>
    <p>Setup fees and one-time charges are due at checkout.</p>
    <p>Signal Works may update these terms with notice; continued use constitutes acceptance of material changes.</p>
  `.trim();

  const { data: created, error } = await supabase
    .from(TABLES.legalDocuments)
    .insert({
      tenant_id: null,
      document_type: "terms_of_service",
      title: "Signal Works Terms of Service",
      version,
      content_html: contentHtml,
      content_text: contentHtml.replace(/<[^>]+>/g, " "),
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
