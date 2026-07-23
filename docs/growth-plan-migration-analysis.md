# Growth Plan Migration Analysis

Phase A does **not** migrate existing Growth clients automatically. This document inventories current usage and recommends mappings before any bulk conversion.

## Current hardcoded plan catalog (`src/lib/plans.ts`)

| Legacy key | Display name | Default price | Env Stripe price var |
|------------|--------------|---------------|----------------------|
| `personal-brand` | Personal Brand | $24.99/mo | `STRIPE_PRICE_PERSONAL_BRAND` |
| `launch-website` | Launch Website | $49.00/mo | `STRIPE_PRICE_LAUNCH` |
| `growth-website` | Growth Website | $99.00/mo | `STRIPE_PRICE_GROWTH` |
| `founding-client` | Founding Client | $25.00/mo | `STRIPE_PRICE_FOUNDING_CLIENT` |

## New catalog tiers (`platform_plan_templates`)

| New key | Name | Default |
|---------|------|---------|
| `brand` | Brand | $49/mo |
| `launch` | Launch | $149/mo |
| `platform` | Platform | $399/mo |
| `custom` | Custom | manual entry |

**Growth is removed** as a plan tier.

**Founding Client** becomes a **discount designation**, not a plan.

## Code paths referencing Growth / legacy plans

| File | Usage | Phase A change |
|------|--------|----------------|
| `src/lib/plans.ts` | Hardcoded catalog | **Retained** for billing portal, checkout, stripe-sync |
| `src/app/api/admin/invite-client/route.ts` | Was primary invite source | **Replaced** with DB catalog + offer-first service |
| `src/components/invite-client-form.tsx` | Legacy plan dropdown | **Replaced** with catalog-driven UI |
| `src/app/api/stripe/checkout/route.ts` | `PLAN_KEYS` checkout | Unchanged in Phase A |
| `src/lib/stripe-sync.ts` | Resolves plan from metadata/price ID | Unchanged in Phase A |
| `src/app/(portal)/billing/page.tsx` | `resolvePlanForClient` | Unchanged in Phase A |
| `src/components/start-checkout-button.tsx` | `PlanKey` type | Unchanged in Phase A |

## Database fields storing plan names

| Table | Column | Notes |
|-------|--------|-------|
| `tenant_portal_settings` | `plan_name` | Compatibility projection from invite; may contain legacy strings |
| `client_offer_items` | `name` + `metadata.plan_key` | **Source of truth** for new invites |
| `tenant_subscriptions` | `stripe_price_id` | Billing truth after Stripe activation |

## Recommended mapping (manual review required)

| Legacy value | Suggested new tier | Notes |
|--------------|-------------------|-------|
| Personal Brand / `personal-brand` | **Brand** | Marketing-site positioning |
| Launch Website / `launch-website` | **Launch** | Website + light tools |
| Growth Website / `growth-website` | **Platform** or **Launch** | Review per client scope; default **Platform** if they have portal/booking features |
| Founding Client / `founding-client` | **Launch** or **Custom** + founding discount | Do not keep as a plan; apply discount on offer items |

## Pre-migration queries (run on live DB before converting)

```sql
-- Distinct portal plan names
select plan_name, count(*) from public.tenant_portal_settings group by 1 order by 2 desc;

-- Distinct offer base plans (after Phase A invites)
select coalesce(metadata->>'plan_key', name) as plan_ref, count(*)
from public.client_offer_items
where item_type = 'base_plan'
group by 1 order by 2 desc;

-- Subscriptions with legacy Stripe price IDs
select stripe_price_id, subscription_status, count(*)
from public.tenant_subscriptions
group by 1, 2;
```

## Decision checklist (per existing tenant)

1. What is the client's actual product scope today?
2. Does their monthly amount match a new tier default or need **Custom**?
3. Was Founding Client pricing a permanent rate? → model as **ongoing discount** on offer items, not a plan name.
4. Is their Stripe subscription on a legacy Price? → **do not** change Price until explicit migration (per stripe-billing skill).

## Phase A scope boundary

- No automatic UPDATE of `tenant_portal_settings.plan_name`
- No Stripe subscription changes
- No data backfill from legacy `plans.ts` keys to `platform_plan_templates`

Complete this analysis per tenant before running any bulk migration script in a later phase.
