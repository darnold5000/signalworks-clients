/**
 * Client portal commercial lifecycle (proposal → agreement → checkout → billing).
 *
 * Authoritative checkout completion: Stripe webhook `checkout.session.completed`
 * with `payment_status === "paid"` (or session `status === "complete"`), which
 * updates purchases, offer status `purchased`, and `tenant_profiles.onboarding_status`
 * to `payment_complete` / `onboarding_complete`. Do not treat browser return URLs alone
 * as payment confirmation.
 *
 * Active subscription signal (post-checkout UI): {@link clientHasHealthySubscription}
 * for good-standing access messaging; {@link clientHasOngoingSubscription} to suppress
 * pre-checkout setup when Stripe still has a subscription (including past_due).
 *
 * Agreement acceptance: rows in `agreement_acceptances` with immutable
 * `document_snapshot_html` per accepted legal document version.
 *
 * Pre-checkout pricing source of truth: `client_offer_items` on the active offer
 * (`published` | `viewed` | `accepted` | `checkout_started`).
 *
 * Compatibility projection only: `tenant_portal_settings.monthly_price_cents` — may lag
 * the offer or reflect discounted MRR after webhook; prefer offer items or purchase snapshot.
 */

export type PortalCommercialPhase =
  | "no_offer"
  | "draft_offer"
  | "published_awaiting_review"
  | "reviewed_pending_agreement"
  | "agreement_accepted_checkout_pending"
  | "checkout_in_progress"
  | "active_subscription"
  | "payment_past_due"
  | "subscription_canceling"
  | "subscription_ended"
  | "one_time_paid_no_subscription";
