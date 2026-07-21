import type Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/supabase/tables";

export async function claimStripeWebhookEvent(
  event: Stripe.Event,
): Promise<{ duplicate: boolean }> {
  const supabase = createServiceClient();
  const { error } = await supabase.from(TABLES.stripeWebhookEvents).insert({
    stripe_event_id: event.id,
    event_type: event.type,
    livemode: event.livemode,
    processed: false,
    payload: event as unknown as Record<string, unknown>,
  });

  if (error?.code === "23505") {
    return { duplicate: true };
  }

  if (error) {
    throw new Error(error.message);
  }

  return { duplicate: false };
}

export async function markStripeWebhookProcessed(
  stripeEventId: string,
  processingError?: string | null,
) {
  const supabase = createServiceClient();
  await supabase
    .from(TABLES.stripeWebhookEvents)
    .update({
      processed: !processingError,
      processing_error: processingError ?? null,
      processed_at: new Date().toISOString(),
    })
    .eq("stripe_event_id", stripeEventId);
}
