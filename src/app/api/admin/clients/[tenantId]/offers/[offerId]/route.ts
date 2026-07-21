import { NextResponse } from "next/server";
import { z } from "zod";
import { calculateOfferTotals } from "@/lib/offers/calculate-totals";
import { getOfferWithItems } from "@/lib/offers/queries";
import { isPlatformAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/supabase/tables";

const itemSchema = z.object({
  itemType: z.enum([
    "base_plan",
    "setup_fee",
    "add_on",
    "custom_service",
    "credit",
    "discount",
  ]),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  quantity: z.number().int().positive().default(1),
  unitAmountCents: z.number().int().nonnegative(),
  billingType: z.enum(["one_time", "recurring"]),
  billingInterval: z.enum(["day", "week", "month", "year"]).optional(),
  billingIntervalCount: z.number().int().positive().default(1),
  discountType: z.enum(["amount", "percent"]).optional(),
  discountAmountCents: z.number().int().nonnegative().optional(),
  discountPercent: z.number().min(0).max(100).optional(),
  discountDurationType: z.enum(["once", "repeating", "forever"]).optional(),
  discountDurationMonths: z.number().int().positive().optional(),
  isOptional: z.boolean().default(false),
  isSelected: z.boolean().default(true),
  sortOrder: z.number().int().nonnegative().default(0),
});

const patchSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  description: z.string().trim().max(5000).optional(),
  requiresTermsAcceptance: z.boolean().optional(),
  addItem: itemSchema.optional(),
  updateItem: itemSchema
    .extend({ id: z.string().uuid() })
    .optional(),
  deleteItemId: z.string().uuid().optional(),
});

async function recalculateOfferTotals(offerId: string) {
  const offer = await getOfferWithItems(offerId);
  if (!offer) return;

  const totals = calculateOfferTotals(offer.items);
  const supabase = await createClient();
  await supabase
    .from(TABLES.clientOffers)
    .update(totals)
    .eq("id", offerId);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tenantId: string; offerId: string }> },
) {
  if (!(await isPlatformAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { offerId } = await params;
  const offer = await getOfferWithItems(offerId);
  if (!offer) {
    return NextResponse.json({ error: "Offer not found" }, { status: 404 });
  }

  return NextResponse.json({ offer });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tenantId: string; offerId: string }> },
) {
  if (!(await isPlatformAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tenantId, offerId } = await params;
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from(TABLES.clientOffers)
    .select("status")
    .eq("id", offerId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Offer not found" }, { status: 404 });
  }

  if (existing.status !== "draft") {
    return NextResponse.json(
      { error: "Only draft offers can be edited" },
      { status: 400 },
    );
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.title) updates.title = parsed.data.title;
  if (parsed.data.description !== undefined) {
    updates.description = parsed.data.description || null;
  }
  if (parsed.data.requiresTermsAcceptance !== undefined) {
    updates.requires_terms_acceptance = parsed.data.requiresTermsAcceptance;
  }

  if (Object.keys(updates).length > 0) {
    await supabase.from(TABLES.clientOffers).update(updates).eq("id", offerId);
  }

  if (parsed.data.addItem) {
    const item = parsed.data.addItem;
    await supabase.from(TABLES.clientOfferItems).insert({
      offer_id: offerId,
      tenant_id: tenantId,
      item_type: item.itemType,
      name: item.name,
      description: item.description ?? null,
      quantity: item.quantity,
      unit_amount_cents: item.unitAmountCents,
      billing_type: item.billingType,
      billing_interval:
        item.billingType === "recurring" ? item.billingInterval ?? "month" : null,
      billing_interval_count: item.billingIntervalCount,
      discount_type: item.discountType ?? null,
      discount_amount_cents: item.discountAmountCents ?? null,
      discount_percent: item.discountPercent ?? null,
      discount_duration_type: item.discountDurationType ?? null,
      discount_duration_months: item.discountDurationMonths ?? null,
      is_optional: item.isOptional,
      is_selected: item.isSelected,
      sort_order: item.sortOrder,
    });
  }

  if (parsed.data.updateItem) {
    const item = parsed.data.updateItem;
    await supabase
      .from(TABLES.clientOfferItems)
      .update({
        item_type: item.itemType,
        name: item.name,
        description: item.description ?? null,
        quantity: item.quantity,
        unit_amount_cents: item.unitAmountCents,
        billing_type: item.billingType,
        billing_interval:
          item.billingType === "recurring"
            ? item.billingInterval ?? "month"
            : null,
        billing_interval_count: item.billingIntervalCount,
        discount_type: item.discountType ?? null,
        discount_amount_cents: item.discountAmountCents ?? null,
        discount_percent: item.discountPercent ?? null,
        discount_duration_type: item.discountDurationType ?? null,
        discount_duration_months: item.discountDurationMonths ?? null,
        is_optional: item.isOptional,
        is_selected: item.isSelected,
        sort_order: item.sortOrder,
      })
      .eq("id", item.id)
      .eq("offer_id", offerId);
  }

  if (parsed.data.deleteItemId) {
    await supabase
      .from(TABLES.clientOfferItems)
      .delete()
      .eq("id", parsed.data.deleteItemId)
      .eq("offer_id", offerId);
  }

  await recalculateOfferTotals(offerId);
  const offer = await getOfferWithItems(offerId);
  return NextResponse.json({ offer });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ tenantId: string; offerId: string }> },
) {
  if (!(await isPlatformAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tenantId, offerId } = await params;
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from(TABLES.clientOffers)
    .select("status")
    .eq("id", offerId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Offer not found" }, { status: 404 });
  }

  if (existing.status !== "draft") {
    return NextResponse.json(
      { error: "Only draft offers can be deleted" },
      { status: 400 },
    );
  }

  await supabase.from(TABLES.clientOffers).delete().eq("id", offerId);
  return NextResponse.json({ ok: true });
}
