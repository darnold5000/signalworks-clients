import { hashDocumentContent } from "@/lib/agreements/document-hash";
import type { LegalDocument } from "@/lib/database/phase1-types";
import { renderSignalWorksTosHtml } from "@/lib/legal/signal-works-tos";
import { logTenantActivity } from "@/lib/activity/log-tenant-activity";
import { createServiceClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/supabase/tables";

export async function hasAcceptedLegalDocument(args: {
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

export async function hasAcceptedOfferTerms(args: {
  tenantId: string;
  offerId: string;
  userId: string;
  legalDocumentId: string;
}): Promise<boolean> {
  return hasAcceptedLegalDocument(args);
}

export async function hasAcceptedRequiredOfferAgreements(args: {
  tenantId: string;
  offerId: string;
  userId: string;
  termsDocumentId?: string | null;
  sowDocumentId?: string | null;
  requiresTerms?: boolean;
}): Promise<boolean> {
  if (args.requiresTerms && args.termsDocumentId) {
    const accepted = await hasAcceptedLegalDocument({
      tenantId: args.tenantId,
      offerId: args.offerId,
      userId: args.userId,
      legalDocumentId: args.termsDocumentId,
    });
    if (!accepted) return false;
  }

  if (args.sowDocumentId) {
    const accepted = await hasAcceptedLegalDocument({
      tenantId: args.tenantId,
      offerId: args.offerId,
      userId: args.userId,
      legalDocumentId: args.sowDocumentId,
    });
    if (!accepted) return false;
  }

  return true;
}

async function insertAgreementAcceptance(args: {
  tenantId: string;
  userId: string;
  offerId: string;
  document: LegalDocument;
  acceptedName: string;
  acceptedEmail: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  effectiveDate?: string;
}) {
  const supabase = createServiceClient();
  const snapshotHtml =
    args.document.document_type === "terms_of_service" && args.effectiveDate
      ? renderSignalWorksTosHtml(args.effectiveDate)
      : args.document.content_html;

  const documentHash = hashDocumentContent(snapshotHtml);

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
      document_snapshot_html: snapshotHtml,
      document_hash: documentHash,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
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
  effectiveDate?: string;
}) {
  const acceptance = await insertAgreementAcceptance(args);

  await logTenantActivity({
    tenantId: args.tenantId,
    actorUserId: args.userId,
    actorType: "user",
    action: "agreement.accepted",
    entityType: "agreement_acceptance",
    entityId: acceptance.id as string,
    summary: `Accepted ${args.document.title} v${args.document.version}`,
  });

  return acceptance;
}

export async function recordOfferAgreementsAcceptance(args: {
  tenantId: string;
  userId: string;
  offerId: string;
  termsDocument?: LegalDocument | null;
  sowDocument?: LegalDocument | null;
  acceptedName: string;
  acceptedEmail: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const effectiveDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  if (args.termsDocument) {
    await recordAgreementAcceptance({
      tenantId: args.tenantId,
      userId: args.userId,
      offerId: args.offerId,
      document: args.termsDocument,
      acceptedName: args.acceptedName,
      acceptedEmail: args.acceptedEmail,
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
      effectiveDate,
    });
  }

  if (args.sowDocument) {
    await recordAgreementAcceptance({
      tenantId: args.tenantId,
      userId: args.userId,
      offerId: args.offerId,
      document: args.sowDocument,
      acceptedName: args.acceptedName,
      acceptedEmail: args.acceptedEmail,
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
      effectiveDate,
    });
  }

  const supabase = createServiceClient();
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
}
