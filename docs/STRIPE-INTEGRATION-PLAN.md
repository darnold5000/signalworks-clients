# Signal Works — Stripe Integration Plan

Generated via Stripe MCP `stripe_implementation_planner` (guide `iguide_61V2c8lTUFmvu2QAL41HdHzYZ54n0`) and aligned with `signalworks-clients`.

**Account:** Signal Works (`acct_1TtDw3HdHzYZ54n0`)  
**Site:** https://hiresignalworks.com  
**Products needed:** Billing, Payments, Invoicing, Tax

---

## Recommended architecture

| Need | Stripe approach | Why |
| --- | --- | --- |
| Website & Support plans (MRR) | Products + Prices + **Checkout Session `mode: subscription`** | Flat monthly plans; hosted Checkout; no custom card UI |
| Client self-serve billing | **Customer Portal** (from branded dashboard) | Update card, invoices, cancel — already scaffolded |
| One-time builds / custom software | **Dashboard Invoices** + templates + Hosted Invoice Page | Low volume; no code for V1 |
| Tax | **Stripe Tax** (`automatic_tax: { enabled: true }`) | Checkout + invoices; add Tax Registrations in Dashboard |
| Keep Supabase in sync | Webhooks | `customer.subscription.*`, `invoice.paid`, `invoice.payment_failed`, `checkout.session.completed` |
| Revenue recovery | Smart Retries (Dashboard) | Zero-code dunning |

**Do not:** rebuild billing UI, store card data, hardcode `payment_method_types`, or use PaymentIntents for renewals.

---

## Decision summary (accepted path)

### Subscriptions (primary)
- Flat-rate monthly Prices (not seats / not usage / not Metronome)
- Web + Next.js code
- Stripe-hosted Checkout (redirect OK)
- Charge at signup (intro pricing = separate Price IDs, not freemium)
- Customer Portal for self-manage (no custom billing UI)
- Smart Retries for failed payments

### Invoicing (secondary)
- Create project invoices in **Dashboard** (+ Invoice Templates)
- Brand invoices (logo / colors)
- Customers pay via **Hosted Invoice Page**
- Sync status into Supabase via webhooks (not ERP)

### Payments / checkout
- Stripe only (no multiprocesor)
- Browser / web
- Not Managed Payments (you sell services, not only digital downloads)

---

## Catalog to create in Stripe

Create as **Products** with recurring **Prices** (test mode first):

| Product | Example price | Notes |
| --- | --- | --- |
| Personal Brand | $24.99 / month | One-page managed site |
| Launch | $49 / month | Standard website & support |
| Growth | (your rate) | Higher ongoing work |
| Founding Client | $25 / month | Intro Price; expire by switching Price later |

Optional one-time Prices for “Purchase Outright” if you sell those via Payment Links / Checkout `mode: payment`.

Store Price IDs in env or a `plans` table — never hardcode amounts in Checkout if the Price already owns the amount.

---

## Code integration map (`signalworks-clients`)

| Piece | Status | Next step |
| --- | --- | --- |
| Customer Portal session | Done (`/api/stripe/portal`) | Add keys; activate Portal in Dashboard |
| Subscription / invoice webhooks | Partial (`/api/stripe/webhook`) | Add `checkout.session.completed`; idempotency; map plan_name from Price |
| Checkout for new subscriptions | Missing | Add `POST /api/stripe/checkout` → redirect |
| Success / cancel pages | Missing | `/billing/success`, return to overview |
| Stripe Tax | Missing | `automatic_tax: { enabled: true }` on Checkout |
| Invoice list in portal | Summary only | Optional: list recent invoices via Stripe API |
| Dashboard Products/Prices | Not created yet | Create in Stripe test mode |
| Env keys | Empty `.env.example` | Use **restricted key** (`rk_`) preferred |

### Checkout Session shape (Node)

```ts
const session = await stripe.checkout.sessions.create({
  mode: "subscription",
  customer: existingCustomerId, // or customer_email for new
  line_items: [{ price: priceId, quantity: 1 }],
  automatic_tax: { enabled: true },
  success_url: `${appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${appUrl}/billing`,
  client_reference_id: clientId, // link back to Supabase clients.id
  metadata: { client_id: clientId },
  // Do NOT set payment_method_types — use Dashboard dynamic methods
});
```

### Extra webhook: `checkout.session.completed`

On subscription Checkout completion, attach `stripe_customer_id` / `stripe_subscription_id` to the Supabase `clients` row using `client_reference_id` or metadata.

---

## Dashboard checklist (do once)

1. **API keys** — [Dashboard keys](https://dashboard.stripe.com/acct_1TtDw3HdHzYZ54n0/apikeys) → prefer Restricted Key with Checkout, Customers, Subscriptions, Invoices, Billing Portal, Tax, Webhooks write/read as needed.
2. **Customer Portal** — Settings → Billing → Customer portal: branding, cancellation rules, invoice history, payment method update.
3. **Tax** — Tax → Registrations for jurisdictions where you must collect; enable Tax on Checkout/Invoices.
4. **Branding** — Settings → Branding (Checkout + Invoices + Portal).
5. **Revenue recovery** — Smart Retries + email reminders on.
6. **Webhook endpoint** — `https://clients.hiresignalworks.com/api/stripe/webhook` (use Stripe CLI locally).
7. **Invoice templates** — for Launch / Growth project invoices.

Local webhook forward:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

---

## Security

- Prefer restricted API keys over unrestricted `sk_`
- Never commit keys; use `.env.local` / Vercel env
- Verify webhook signatures (`STRIPE_WEBHOOK_SECRET`)
- Never store PAN / CVC — only Stripe IDs in Supabase

---

## Docs (chosen path)

- [Billing / hosted Checkout](https://docs.stripe.com/payments/accept-a-payment?payment-ui=checkout&ui=stripe-hosted)
- [Customer Portal](https://docs.stripe.com/customer-management/integrate-customer-portal)
- [Flat-rate pricing](https://docs.stripe.com/subscriptions/pricing-models/flat-rate-pricing?dashboard-or-api=dashboard)
- [Revenue recovery](https://docs.stripe.com/billing/revenue-recovery)
- [Collect taxes for recurring payments](https://docs.stripe.com/billing/taxes/collect-taxes)
- [Dashboard invoicing](https://docs.stripe.com/invoicing/dashboard)
- [Invoice templates](https://docs.stripe.com/invoicing/invoice-rendering-template)
- [Hosted Invoice Page](https://docs.stripe.com/invoicing/hosted-invoice-page)
- [Subscription webhooks](https://docs.stripe.com/billing/subscriptions/webhooks)
