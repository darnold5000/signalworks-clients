import type Stripe from "stripe";

/** User-safe Stripe failure detail for admin APIs (no secrets). */
export function formatStripeSyncError(error: unknown): string {
  if (!error) return "Unknown error";

  if (typeof error === "object" && error !== null && "type" in error) {
    const stripeErr = error as Stripe.errors.StripeError;
    const parts = [stripeErr.message];
    if (stripeErr.code) parts.push(`(${stripeErr.code})`);
    return parts.join(" ");
  }

  if (error instanceof Error) return error.message;
  return String(error);
}
