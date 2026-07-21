import { NextResponse } from "next/server";
import { z } from "zod";
import { logTenantActivity } from "@/lib/activity/log-tenant-activity";
import { listOffersForTenant } from "@/lib/offers/queries";
import { getCurrentProfile, isPlatformAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/supabase/tables";

const createSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(5000).optional(),
  currency: z.string().trim().length(3).default("usd"),
  requiresTermsAcceptance: z.boolean().default(true),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  if (!(await isPlatformAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tenantId } = await params;
  const offers = await listOffersForTenant(tenantId);
  return NextResponse.json({ offers });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const profile = await getCurrentProfile();
  if (!profile || !(await isPlatformAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tenantId } = await params;
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: offer, error } = await supabase
    .from(TABLES.clientOffers)
    .insert({
      tenant_id: tenantId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      currency: parsed.data.currency.toLowerCase(),
      requires_terms_acceptance: parsed.data.requiresTermsAcceptance,
      status: "draft",
      created_by: profile.id,
    })
    .select("*")
    .single();

  if (error || !offer) {
    return NextResponse.json(
      { error: error?.message ?? "Could not create offer" },
      { status: 400 },
    );
  }

  await logTenantActivity({
    tenantId,
    actorUserId: profile.id,
    actorType: "admin",
    action: "offer.created",
    entityType: "client_offer",
    entityId: offer.id as string,
    summary: `Created draft offer "${parsed.data.title}"`,
  });

  return NextResponse.json({ offer });
}
