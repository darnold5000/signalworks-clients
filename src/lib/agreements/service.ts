import { hashDocumentContent } from "@/lib/agreements/document-hash";
import type { LegalDocument } from "@/lib/database/phase1-types";
import { logTenantActivity } from "@/lib/activity/log-tenant-activity";
import { createServiceClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/supabase/tables";

export async function hasAcceptedOfferTerms(args: {
  tenantId: string;
  offerId: string;
  userId: string;
  legalDocumentId: string;
}): Promise<boolean> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from(TABLES.agreementAcceptances)
    .select("id")
    .eq("tenant_id", args.tenantId)
    .eq("offer_id", args.offerId)
    .eq("user_id", args.userId)
    .eq("legal_document_id", args.legalDocumentId)
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

export async function recordAgreementAcceptance(args: {
  tenantId: string;
  userId: string;
  offerId: string;
  document: LegalDocument;
  acceptedName: string;
  acceptedEmail: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const supabase = createServiceClient();
  const documentHash = hashDocumentContent(args.document.content_html);

  const { data, error } = await supabase
    .from(TABLES.agreementAcceptances)
    .insert({
      tenant_id: args.tenantId,
      user_id: args.userId,
      offer_id: args.offerId,
      legal_document_id: args.document.id,
      document_version: args.document.version,
      accepted_name: args.acceptedName,
      accepted_email: args.acceptedEmail,
      accepted_at: new Date().toISOString(),
      ip_address: args.ipAddress ?? null,
      user_agent: args.userAgent ?? null,
      document_snapshot_html: args.document.content_html,
      document_hash: documentHash,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await supabase
    .from(TABLES.clientOffers)
    .update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
    })
    .eq("id", args.offerId);

  await supabase
    .from(TABLES.tenantProfiles)
    .update({ onboarding_status: "terms_accepted" })
    .eq("tenant_id", args.tenantId);

  await logTenantActivity({
    tenantId: args.tenantId,
    actorUserId: args.userId,
    actorType: "user",
    action: "agreement.accepted",
    entityType: "agreement_acceptance",
    entityId: data.id as string,
    summary: `Accepted ${args.document.title} v${args.document.version}`,
  });

  return data;
}
