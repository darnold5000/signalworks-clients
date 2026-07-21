import { NextResponse } from "next/server";
import { z } from "zod";
import { getActiveOfferForTenant, getLegalDocument } from "@/lib/offers/queries";
import { getCurrentProfile } from "@/lib/auth";
import { getPrimaryClient } from "@/lib/data";
import { getOnboardingState } from "@/lib/portal/onboarding-state";

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await getPrimaryClient();
  if (!client) {
    return NextResponse.json({ error: "No client access" }, { status: 403 });
  }

  const offer = await getActiveOfferForTenant(client.id);
  const onboarding = await getOnboardingState(client, profile.id);
  let terms = null;

  if (offer?.terms_document_id) {
    terms = await getLegalDocument(offer.terms_document_id);
  }

  return NextResponse.json({
    client,
    offer,
    terms,
    onboarding,
  });
}

const companySchema = z.object({
  legalBusinessName: z.string().trim().min(2).max(200),
  primaryContactName: z.string().trim().min(2).max(120),
  primaryContactEmail: z.string().trim().email(),
  primaryContactPhone: z.string().trim().max(40).optional(),
  websiteUrl: z.string().trim().max(300).optional(),
  primaryDomain: z.string().trim().max(200).optional(),
});

export async function PATCH(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await getPrimaryClient();
  if (!client) {
    return NextResponse.json({ error: "No client access" }, { status: 403 });
  }

  const parsed = companySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { createServiceClient } = await import("@/lib/supabase/server");
  const { TABLES } = await import("@/lib/supabase/tables");
  const supabase = createServiceClient();

  await supabase.from(TABLES.tenantProfiles).upsert(
    {
      tenant_id: client.id,
      legal_business_name: parsed.data.legalBusinessName,
      display_name: parsed.data.legalBusinessName,
      primary_contact_name: parsed.data.primaryContactName,
      primary_contact_email: parsed.data.primaryContactEmail,
      primary_contact_phone: parsed.data.primaryContactPhone ?? null,
      website_url: parsed.data.websiteUrl ?? client.website_url,
      primary_domain: parsed.data.primaryDomain ?? client.domain,
      internal_status: "onboarding",
      onboarding_status: "company_information_confirmed",
    },
    { onConflict: "tenant_id" },
  );

  await supabase
    .from(TABLES.tenantPortalSettings)
    .update({
      support_email: parsed.data.primaryContactEmail,
      support_phone: parsed.data.primaryContactPhone ?? null,
      website_url: parsed.data.websiteUrl ?? client.website_url,
      domain: parsed.data.primaryDomain ?? client.domain,
    })
    .eq("tenant_id", client.id);

  return NextResponse.json({ ok: true });
}
