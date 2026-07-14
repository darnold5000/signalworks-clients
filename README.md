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

## Production setup

1. Create a dedicated Supabase project.
2. Run `supabase/migrations/001_initial.sql`, then optionally `supabase/seed.sql`.
3. Create Auth users; set `profiles.role = 'admin'` for you; link clients via `client_members`.
4. Configure Stripe Customer Portal in the Stripe Dashboard (branding, cancellation rules).
5. Copy `.env.example` → `.env.local` and fill values.
6. Point Stripe webhook to `https://clients.hiresignalworks.com/api/stripe/webhook`.
7. Deploy to Vercel; attach custom domain `clients.hiresignalworks.com`.

## Docs

See [docs/V1-PLAN.md](docs/V1-PLAN.md) for the product/architecture plan.
