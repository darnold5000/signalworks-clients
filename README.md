# Signal Works Client Portal

Branded client + admin dashboard for Signal Works managed websites.

**Deploy target:** `clients.hiresignalworks.com`

## What V1 includes

**Client**
- Secure login (Supabase Auth) or local demo mode
- Overview: website status, plan, next billing date
- Manage Billing → Stripe Customer Portal session
- Request an update + request history
- Documents + support contact

**Admin**
- Client list with MRR, past-due count
- Client detail: Stripe status, domain/hosting, infra cost, margin, notes, requests

**Integrations**
- Supabase Auth + Postgres + RLS
- Stripe portal + webhooks (subscription + invoice events)

Billing UX stays in Stripe. This app stores only Stripe IDs.

## Quick start (demo UI)

```bash
npm install
npm run dev
```

Open [http://localhost:3000/login](http://localhost:3000/login) → **Demo as client** or **Demo as admin**.

No Supabase/Stripe env vars required for UI review.

## Database (shared Signal Works multi-tenant)

This app uses the **shared Signal Works multi-tenant Supabase project** (`signalworks-services`). Apply migrations in order:

1. [`signalworks-platform/core/supabase/migrations/001_platform_foundation.sql`](../signalworks-platform/core/supabase/migrations/001_platform_foundation.sql) — `tenants`, `profiles`, `tenant_memberships`, roles/permissions, RLS helpers
2. [`supabase/migrations/001_client_portal.sql`](supabase/migrations/001_client_portal.sql) — portal settings, `tenant_subscriptions`, `service_requests`, `documents`
3. Optionally [`supabase/seed.sql`](supabase/seed.sql)

**Bootstrap your admin account** after creating an Auth user:

```sql
insert into public.tenant_memberships (tenant_id, user_id, role_id, status)
select t.id, '<your-auth-user-uuid>', r.id, 'active'
from public.tenants t
join public.roles r on r.slug = 'platform_admin' and r.tenant_id is null
where t.slug = 'signalworks'
on conflict (tenant_id, user_id) do update set role_id = excluded.role_id, status = 'active';
```

Client onboarding uses **Invite client** in admin (creates a `tenants` row + `tenant_portal_settings` + `tenant_memberships` with the `tenant_owner` role).

## Production setup

1. Set shared multi-tenant Supabase env vars in Vercel.
2. Configure Stripe Customer Portal (branding, cancellation rules).
3. Point Stripe webhook to `https://clients.hiresignalworks.com/api/stripe/webhook`.
4. Deploy to Vercel; attach custom domain `clients.hiresignalworks.com`.

## Passwords & security

- Client passwords are handled by **Supabase Auth**. They are stored as one-way hashes — not plaintext, and not in portal tables.
- You should **not** know a client’s password. Use **Invite client** so they set it themselves.
- Emergency access: Supabase Dashboard → Authentication → user → **Send password recovery** or reset. Your admin account manages their data; you don’t need their password.
- Never store passwords in notes, email, or your own DB.

## Client onboarding (sales-led)

The portal is **not** a public signup. New customers do not self-register and pick a plan.

1. You close the deal and choose the plan (Launch, Growth, etc.).
2. In admin, use **Invite client** (creates a `tenants` row with portal settings and membership).
3. Client receives invite email and sets their password.

Optional later: Stripe Payment Link for the Price, then attach `cus_` / `sub_` to the client row; invite email from Supabase; admin “Invite client” button.

## Docs

See [docs/V1-PLAN.md](docs/V1-PLAN.md) for the product/architecture plan.
See [docs/STRIPE-INTEGRATION-PLAN.md](docs/STRIPE-INTEGRATION-PLAN.md) for Stripe.
