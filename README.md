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

## Database (shared Dugout Intel)

This app uses the same Supabase project as DAWG / Cornerstone, with **`sw_*` prefixed tables** only.

1. Open Dugout Intel in Supabase → **SQL Editor**.
2. Run [`supabase/migrations/001_initial.sql`](supabase/migrations/001_initial.sql).
3. Optionally run [`supabase/seed.sql`](supabase/seed.sql).
4. **Authentication → Users → Add user**, then set `sw_profiles.role = 'admin'` for your account.
5. Link client logins with `sw_client_members`.

Do not create unprefixed `profiles` / `clients` tables in this shared project.

## Production setup

1. Keep Dugout Intel env vars in Vercel (same project as DAWG/Cornerstone).
2. Configure Stripe Customer Portal (branding, cancellation rules).
3. Point Stripe webhook to `https://clients.hiresignalworks.com/api/stripe/webhook`.
4. Deploy to Vercel; attach custom domain `clients.hiresignalworks.com`.

## Passwords & security

- Client passwords are handled by **Supabase Auth**. They are stored as one-way hashes — not plaintext, and not in `sw_*` tables.
- You should **not** know a client’s password. Use **Invite client** so they set it themselves.
- Emergency access: Supabase Dashboard → Authentication → user → **Send password recovery** or reset. Your admin account manages their data; you don’t need their password.
- Never store passwords in notes, email, or your own DB.

## Client onboarding (sales-led)

The portal is **not** a public signup. New customers do not self-register and pick a plan.

1. You close the deal and choose the plan (Launch, Growth, etc.).
2. In admin / Supabase, create an `sw_clients` row with that `plan_name`.
3. Create their Auth user (or invite) and link them in `sw_client_members`.
4. Send them `https://clients.hiresignalworks.com` + login (or a magic invite later).
5. They sign in → Billing shows **only their plan** → Checkout → Manage Billing.

Optional later: Stripe Payment Link for the Price, then attach `cus_` / `sub_` to the client row; invite email from Supabase; admin “Invite client” button.

## Docs

See [docs/V1-PLAN.md](docs/V1-PLAN.md) for the product/architecture plan.
See [docs/STRIPE-INTEGRATION-PLAN.md](docs/STRIPE-INTEGRATION-PLAN.md) for Stripe.
