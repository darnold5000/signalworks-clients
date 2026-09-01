import type { createClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/supabase/tables";

/** Replaces the ordered scope rows so repeated Save Draft calls cannot accumulate duplicates. */
export async function replaceOfferFeatures(args: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  tenantId: string;
  offerId: string;
  labels: string[];
}): Promise<string | null> {
  const { error: deleteError } = await args.supabase
    .from(TABLES.clientOfferFeatures)
    .delete()
    .eq("offer_id", args.offerId);
  if (deleteError) return "Could not update proposal features";

  if (args.labels.length === 0) return null;

  const { error: insertError } = await args.supabase
    .from(TABLES.clientOfferFeatures)
    .insert(
      args.labels.map((label, sortOrder) => ({
        offer_id: args.offerId,
        tenant_id: args.tenantId,
        label,
        sort_order: sortOrder,
      })),
    );
  return insertError ? "Could not update proposal features" : null;
}
