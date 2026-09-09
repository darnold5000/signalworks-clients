import type Stripe from "stripe";
import type { OfferCheckoutReturnContext } from "@/lib/offers/checkout-return-urls";
import { createOfferCheckoutSession } from "@/lib/offers/checkout";
import { getOfferWithItemsWithServiceClient } from "@/lib/offers/queries";
import { checkoutSessionCompleted } from "@/lib/offers/checkout-state";
import { createServiceClient } from "@/lib/supabase/server";
import {
  checkoutStageIsFinal,
  syncClientFromCheckoutSession,
} from "@/lib/stripe-sync";

export type MixedCheckoutContinuation =
  | { status: "redirect"; url: string }
  | { status: "complete"; sessionId: string }
  | { status: "awaiting_confirmation" }
  | { status: "needs_manual_continue" };

function sessionCustomerId(
  session: Stripe.Checkout.Session,
): string | null {
  if (typeof session.customer === "string") return session.customer;
  return session.customer?.id ?? null;
}

export function isSafeCheckoutRedirectUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      (parsed.hostname === "checkout.stripe.com" ||
        parsed.hostname.endsWith(".stripe.com"))
    );
  } catch {
    return false;
  }
}

export function isCompletedMonthlyHandoff(
  session: Stripe.Checkout.Session,
  tenantId: string,
): boolean {
  return (
    session.metadata?.tenant_id === tenantId &&
    session.metadata?.checkout_stage_cadence === "month" &&
    session.metadata?.checkout_stage_final === "false" &&
    checkoutSessionCompleted(session)
  );
}

export function requestFromHeaders(
  headerList: Headers,
  path = "/billing/continue",
): Request {
  const host =
    headerList.get("x-forwarded-host") ??
    headerList.get("host") ??
    "localhost:3000";
  const proto = headerList.get("x-forwarded-proto") ?? "https";
  const headers = new Headers();
  const forwardedHost = headerList.get("x-forwarded-host");
  const forwardedProto = headerList.get("x-forwarded-proto");
  if (forwardedHost) headers.set("x-forwarded-host", forwardedHost);
  if (forwardedProto) headers.set("x-forwarded-proto", forwardedProto);
  const incomingHost = headerList.get("host");
  if (incomingHost) headers.set("host", incomingHost);
  return new Request(`${proto}://${host}${path}`, { headers });
}

/**
 * Browser-return path for mixed monthly/annual Checkout.
 *
 * Stripe's completed Session is the trigger, not `purchases.checkout_state`.
 * The webhook remains the authoritative writer; this path reconciles the same
 * stage idempotently, then creates or resumes the annual Session.
 */
export async function continueMixedCheckoutFromReturnedSession(args: {
  session: Stripe.Checkout.Session;
  tenantId: string;
  purchaserUserId: string | null;
  purchaserEmail: string;
  request: Request;
  existingCustomerId?: string | null;
  returnContext?: OfferCheckoutReturnContext;
}): Promise<MixedCheckoutContinuation> {
  if (args.session.metadata?.tenant_id !== args.tenantId) {
    return { status: "awaiting_confirmation" };
  }

  if (!checkoutSessionCompleted(args.session)) {
    return { status: "awaiting_confirmation" };
  }

  await syncClientFromCheckoutSession(args.session);

  if (checkoutStageIsFinal(args.session.metadata)) {
    return { status: "complete", sessionId: args.session.id };
  }

  if (!isCompletedMonthlyHandoff(args.session, args.tenantId)) {
    return { status: "awaiting_confirmation" };
  }

  const offerId = args.session.metadata?.offer_id;
  if (!offerId) return { status: "needs_manual_continue" };

  const offer = await getOfferWithItemsWithServiceClient(
    offerId,
    createServiceClient(),
  );
  if (!offer || offer.tenant_id !== args.tenantId) {
    return { status: "needs_manual_continue" };
  }

  try {
    const { session } = await createOfferCheckoutSession({
      offer,
      purchaserUserId: args.purchaserUserId,
      purchaserEmail: args.purchaserEmail,
      request: args.request,
      existingCustomerId:
        args.existingCustomerId ?? sessionCustomerId(args.session),
      returnContext: args.returnContext,
    });

    if (session.url && isSafeCheckoutRedirectUrl(session.url)) {
      return { status: "redirect", url: session.url };
    }
    if (
      checkoutSessionCompleted(session) &&
      session.metadata?.checkout_stage_final !== "false"
    ) {
      return { status: "complete", sessionId: session.id };
    }
  } catch (error) {
    console.error("continueMixedCheckoutFromReturnedSession", error);
  }

  return { status: "needs_manual_continue" };
}
