# Annual recurring billing

## Canonical representation

Recurring offer and purchase items use Stripe-native cadence fields:

- monthly: `billing_type = recurring`, `billing_interval = month`
- annual: `billing_type = recurring`, `billing_interval = year`
- one-time: `billing_type = one_time`, `billing_interval = null`

Legacy recurring items with a null interval resolve to monthly. Annual cadence is
never encoded in descriptions and annual charges are never converted to monthly
charges for billing or proposal display.

`recurring_total_cents` remains the monthly recurring/MRR compatibility field.
`annual_recurring_total_cents` stores the full annual recurring charge. ARR is
calculated as `monthly recurring × 12 + annual recurring`.

## Due Today

All proposal recurring services start immediately. Due Today is therefore:

`max(0, one-time charges + first monthly charge - first-cycle discounts) + first annual charge`

Monthly recurring discounts are already reflected in the first monthly charge.
First-cycle coupons belong to the first (monthly plus one-time) Checkout stage
and cannot spill over to reduce the separate annual stage.
This is the same total Stripe collects across the immediate hosted Checkout
stages. Proposal Only offers show that billing is handled separately instead.

## Stripe Checkout

Stripe Prices retain their native `month` or `year` interval. Stripe supports a
mixed-interval subscription through the Subscriptions API in flexible billing
mode, but Stripe Checkout Sessions cannot create one. To keep hosted Checkout,
the application partitions a mixed offer into two stages tied to one purchase
and Stripe Customer:

1. monthly recurring prices plus one-time prices
2. annual recurring prices

The first successful stage returns to a short transition screen explaining that
monthly billing is set up and annual billing remains. Its continuation action
opens the second hosted Session. A single-cadence offer continues to use one
Checkout Session. Webhook metadata prevents the proposal and purchase from
becoming complete until the final stage succeeds.

### Durable mixed-checkout state

The existing `purchases` row remains the single purchase record. Its
`checkout_state` records `pending`, `monthly_complete`, `annual_complete`,
`complete`, `failed`, or `canceled`; cadence-specific Session IDs make each
stage resumable. `purchase_items.service_status` identifies which contracted
services are actually active. Stripe subscriptions continue to live in the
existing `tenant_subscriptions` table.

Checkout Session creation uses a deterministic Stripe idempotency key per
offer, stage, and attempt. An open Session is reused. A completed monthly
Session is skipped, and resume proceeds directly to annual. An expired attempt
gets a new deterministic attempt key without recreating the completed monthly
subscription.

### Partial completion and recovery

- If monthly succeeds and annual is abandoned, the monthly subscription stays
  active. The purchase remains `checkout_created` with
  `checkout_state = monthly_complete`, the annual items remain pending, and the
  client can resume from Billing. The state remains partial while an annual
  Session is open; an abandoned Session eventually expires and becomes
  recoverable `failed` state.
- If the annual Session expires or an asynchronous payment fails, the checkout
  state becomes `failed` while the purchase remains recoverable. Retrying opens
  only a replacement annual Session.
- Using Stripe's back/cancel link does not immediately cancel an already-live
  monthly subscription or mark the whole purchase canceled, because another
  tab may still be completing annual setup. The open annual Session remains
  resumable; if abandoned, Stripe expiration moves it to recoverable `failed`.
- Delayed webhooks do not block recovery: the transition/resume path verifies
  the Session with Stripe and performs the same idempotent synchronization.
  Webhook events remain authoritative and are claimed by Stripe event ID before
  processing.
- Concurrent browser tabs reuse the stored open Session and the same Stripe
  idempotency key, preventing duplicate subscriptions.
- No automatic rollback occurs. A successfully created monthly subscription is
  never canceled merely because annual setup was abandoned.
- The offer becomes `purchased`, the purchase becomes `active`/`paid`, and the
  final success UI appears only after the final required stage succeeds.

## Discounts

The current commercial configurator supports monthly recurring discounts only.
Their metadata explicitly scopes them to `month`, and their Stripe coupon is
used only on the monthly Checkout stage. Annual discounts are intentionally not
offered until the discount model can represent their duration and invoice scope
without ambiguity.

Stripe Checkout accepts only one coupon for a Session. Combining a monthly
recurring coupon with a separate first-cycle coupon in the same monthly stage is
not supported by the current offer model and must not be inferred or merged.

## Reporting and account summaries

MRR includes monthly recurring services only. Annual charges are exposed as
annual recurring revenue and contribute to ARR without being amortized into MRR.
Stripe subscription synchronization continues to store each staged subscription
and uses item-level period ends, so monthly and annual renewals remain distinct.
During partial completion, active financial reporting is built from the Stripe
subscriptions that actually exist: monthly MRR may be active while annual active
recurring remains zero. The accepted proposal continues to preserve the annual
contractual amount as pending setup.
