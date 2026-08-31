import { createHash, randomBytes } from "node:crypto";
import { logTenantActivity } from "@/lib/activity/log-tenant-activity";
import { deliverClientProposalLink } from "@/lib/admin/client-invite-link";
import { proposalCanBeSent, proposalSendDisabledReason } from "@/lib/admin/proposal-send-policy";
import type { TenantContact } from "@/lib/database/phase1-types";
import { prepareOfferForSend } from "@/lib/offers/prepare-offer-for-send";
import { getOfferWithItems } from "@/lib/offers/queries";
import { portalUrlForInvites } from "@/lib/site";
import { createServiceClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/supabase/tables";

export function hashProposalAccessToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export type ProposalDeliveryResult = {
  contactId: string;
  email: string;
  name: string;
  deliveryStatus: "sent" | "failed" | "link_ready";
  portalLink: string | null;
  error: string | null;
};

export type SendProposalResult =
  | { ok: true; message: string; deliveries: ProposalDeliveryResult[] }
  | { ok: false; error: string };

export async function sendProposalToClient(args: {
  tenantId: string;
  offerId: string;
  actorUserId: string | null;
  contactIds: string[];
}): Promise<SendProposalResult> {
  const supabase = createServiceClient();
  const initialOffer = await getOfferWithItems(args.offerId);
  if (!initialOffer || initialOffer.tenant_id !== args.tenantId) return { ok: false, error: "Offer not found." };
  if (!proposalCanBeSent(initialOffer.status)) {
    return { ok: false, error: proposalSendDisabledReason(initialOffer.status) ?? "This proposal cannot be sent in its current state." };
  }
  const uniqueIds = [...new Set(args.contactIds)];
  if (uniqueIds.length === 0) return { ok: false, error: "Select at least one proposal recipient." };

  const { data: contactRows, error: contactsError } = await supabase.from(TABLES.tenantContacts).select("*").eq("tenant_id", args.tenantId).in("id", uniqueIds);
  if (contactsError) return { ok: false, error: contactsError.message };
  const contacts = (contactRows ?? []) as TenantContact[];
  if (contacts.length !== uniqueIds.length || contacts.some((contact) => !contact.email)) {
    return { ok: false, error: "One or more selected contacts are invalid or do not have an email address." };
  }

  let offer = initialOffer;
  if (offer.status === "draft") {
    try {
      offer = await prepareOfferForSend(args);
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Could not prepare proposal for sending." };
    }
  }

  const { data: tenant } = await supabase.from(TABLES.tenants).select("display_name").eq("id", args.tenantId).maybeSingle();
  const deliveries: ProposalDeliveryResult[] = [];
  for (const contact of contacts) {
    const token = randomBytes(32).toString("base64url");
    const tokenHash = hashProposalAccessToken(token);
    const portalLink = `${portalUrlForInvites().replace(/\/$/, "")}/proposal/${token}`;
    const email = contact.email!.trim().toLowerCase();
    const { data: existing } = await supabase.from(TABLES.proposalRecipients).select("id").eq("offer_id", args.offerId).eq("email", email).maybeSingle();
    const pending = { offer_id: args.offerId, tenant_id: args.tenantId, contact_id: contact.id, email, name: contact.name, access_token_hash: tokenHash, delivery_status: "pending", sent_at: null, last_error: null };
    const recordQuery = existing?.id
      ? supabase.from(TABLES.proposalRecipients).update(pending).eq("id", existing.id)
      : supabase.from(TABLES.proposalRecipients).insert(pending);
    const { error: recordError } = await recordQuery;
    if (recordError) {
      deliveries.push({ contactId: contact.id, email, name: contact.name, deliveryStatus: "failed", portalLink: null, error: recordError.message });
      continue;
    }

    const delivery = await deliverClientProposalLink({ email, fullName: contact.name, businessName: String(tenant?.display_name ?? "your business"), offerTitle: offer.title, portalLink, linkType: "proposal" });
    const deliveryStatus = delivery.deliveryMethod === "email" ? "sent" : delivery.emailError ? "failed" : "link_ready";
    await supabase.from(TABLES.proposalRecipients).update({ delivery_status: deliveryStatus, sent_at: deliveryStatus === "sent" ? new Date().toISOString() : null, last_error: delivery.emailError }).eq("offer_id", args.offerId).eq("email", email);
    deliveries.push({ contactId: contact.id, email, name: contact.name, deliveryStatus, portalLink: deliveryStatus === "sent" ? null : portalLink, error: delivery.emailError });
  }

  const sent = deliveries.filter((delivery) => delivery.deliveryStatus === "sent");
  if (sent.length > 0 && initialOffer.status === "draft") {
    const now = new Date().toISOString();
    await supabase.from(TABLES.clientOffers).update({ status: "published", published_at: now }).eq("id", args.offerId).eq("status", "draft");
    await supabase.from(TABLES.tenantProfiles).update({ internal_status: "awaiting_agreement", onboarding_status: "invited" }).eq("tenant_id", args.tenantId);
  }

  await logTenantActivity({
    tenantId: args.tenantId, actorUserId: args.actorUserId, actorType: "admin", action: "offer.proposal_delivery", entityType: "client_offer", entityId: args.offerId,
    summary: `Proposal “${offer.title}” delivery attempted for ${deliveries.length} recipient${deliveries.length === 1 ? "" : "s"}`,
    metadata: { recipients: deliveries.map(({ email, deliveryStatus, error }) => ({ email, delivery_status: deliveryStatus, error })) },
  });

  return { ok: true, deliveries, message: sent.length > 0 ? `Proposal sent in ${sent.length} separate email${sent.length === 1 ? "" : "s"}.` : "No email was sent. Copy the private recipient link(s) below, or configure email delivery and try again." };
}
