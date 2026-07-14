# Signal Works Client Portal — V1 Plan

Deploy target: `clients.hiresignalworks.com` (separate Vercel project from the marketing site).

## Principles

- Branded Signal Works dashboard for status, updates, and support.
- Stripe Customer Portal for all payment actions (cards, invoices, cancel).
- Store only Stripe IDs in Supabase — never card data.
- Keep V1 small; do not lead sales with the portal.

## Stack

- Next.js (App Router) + Tailwind
- Supabase Auth + Postgres + RLS
- Stripe Checkout / Payment Links + Customer Portal + webhooks
- Vercel

## Data model

| Table | Purpose |
| --- | --- |
| `profiles` | Auth user ↔ role (`client` \| `admin`) |
| `clients` | Business record, site/domain/hosting, plan, Stripe IDs, infra cost |
| `client_members` | Which profiles can access which client |
| `service_requests` | Update requests + status workflow |
| `documents` | Important docs (contracts, guides) metadata + URL |

Stripe fields on `clients`: `stripe_customer_id`, `stripe_subscription_id`, `stripe_price_id`, plus mirrored status/price/period from webhooks.

## Client routes

| Route | Content |
| --- | --- |
| `/login` | Email/password (Supabase Auth) |
| `/overview` | Status, plan, next bill, CTAs |
| `/requests` | Submit + history |
| `/billing` | Summary + Manage Billing → Portal |
| `/documents` | Important files |
| `/support` | Contact |

## Admin routes

| Route | Content |
| --- | --- |
| `/admin` | Client list, MRR snapshot |
| `/admin/clients/[id]` | Full operating record + requests + notes |

## Stripe webhooks (V1)

- `customer.subscription.created` / `updated` / `deleted`
- `invoice.paid` / `invoice.payment_failed`
- `checkout.session.completed` (optional if using Checkout)

Portal sessions are created on demand via `POST /api/stripe/portal`.

## Demo mode

Without Supabase env vars, the app serves seeded demo clients (Bloom Studio Salon, Zero Limits Baseball) so UI can be reviewed locally.
