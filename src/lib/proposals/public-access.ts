import type { ClientOffer, ClientOfferFeature, ClientOfferItem, LegalDocument, ProposalRecipient } from "@/lib/database/phase1-types";
import { hashProposalAccessToken } from "@/lib/admin/send-proposal-service";
import { createServiceClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/supabase/tables";

export type PublicProposal = {
  recipient: ProposalRecipient;
  offer: ClientOffer & { items: ClientOfferItem[]; features: ClientOfferFeature[] };
  terms: LegalDocument | null;
  sow: LegalDocument | null;
};

export async function getPublicProposal(token: string, markViewed = false): Promise<PublicProposal | null> {
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(token)) return null;
  const supabase = createServiceClient();
  const { data: recipient } = await supabase.from(TABLES.proposalRecipients).select("*").eq("access_token_hash", hashProposalAccessToken(token)).maybeSingle();
  if (!recipient) return null;
  const { data: offer } = await supabase.from(TABLES.clientOffers).select("*").eq("id", recipient.offer_id).eq("tenant_id", recipient.tenant_id).maybeSingle();
  if (!offer || offer.status === "canceled" || offer.status === "expired") return null;
  const [{ data: items }, { data: features }] = await Promise.all([
    supabase.from(TABLES.clientOfferItems).select("*").eq("offer_id", offer.id).order("sort_order"),
    supabase.from(TABLES.clientOfferFeatures).select("*").eq("offer_id", offer.id).order("sort_order"),
  ]);
  const documentIds = [offer.terms_document_id, offer.sow_document_id].filter(Boolean) as string[];
  const { data: documents } = documentIds.length
    ? await supabase.from(TABLES.legalDocuments).select("*").in("id", documentIds)
    : { data: [] };
  if (markViewed && (offer.status === "draft" || offer.status === "published" || offer.status === "viewed")) {
    const now = new Date().toISOString();
    await supabase.from(TABLES.proposalRecipients).update({ viewed_at: recipient.viewed_at ?? now }).eq("id", recipient.id);
    if (offer.status === "draft" || offer.status === "published") {
      await supabase.from(TABLES.clientOffers).update({ status: "viewed", published_at: offer.published_at ?? now }).eq("id", offer.id).in("status", ["draft", "published"]);
      await supabase.from(TABLES.tenantProfiles).update({ internal_status: "awaiting_agreement", onboarding_status: "offer_viewed" }).eq("tenant_id", offer.tenant_id);
      offer.status = "viewed";
    }
  }
  return {
    recipient: recipient as ProposalRecipient,
    offer: { ...(offer as ClientOffer), items: (items ?? []) as ClientOfferItem[], features: (features ?? []) as ClientOfferFeature[] },
    terms: ((documents ?? []).find((document) => document.id === offer.terms_document_id) as LegalDocument | undefined) ?? null,
    sow: ((documents ?? []).find((document) => document.id === offer.sow_document_id) as LegalDocument | undefined) ?? null,
  };
}
