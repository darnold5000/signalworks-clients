import Stripe from "stripe";

const purchaseId = process.argv[2];
if (!purchaseId) throw new Error("purchase id required");

const dbOnly = process.argv.includes("--db-only");
const stripe = dbOnly ? null : new Stripe(process.env.STRIPE_SECRET_KEY);

async function tableRows(table, query) {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${table}?${query}`,
    {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    },
  );
  if (!response.ok) {
    throw new Error(`${table}: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

const [purchaseRows, items, subscriptions] = await Promise.all([
  tableRows("purchases", `select=*&id=eq.${encodeURIComponent(purchaseId)}`),
  tableRows(
    "purchase_items",
    `select=*&purchase_id=eq.${encodeURIComponent(purchaseId)}`,
  ),
  tableRows(
    "tenant_subscriptions",
    `select=*&purchase_id=eq.${encodeURIComponent(purchaseId)}`,
  ),
]);
const purchase = purchaseRows[0];
if (!purchase) throw new Error("Purchase not found");

const [offerRows, offerItems, webhookRows] = await Promise.all([
  tableRows(
    "client_offers",
    `select=*&id=eq.${encodeURIComponent(purchase.offer_id)}`,
  ),
  tableRows(
    "client_offer_items",
    `select=*&offer_id=eq.${encodeURIComponent(purchase.offer_id)}&order=sort_order.asc`,
  ),
  tableRows(
    "stripe_webhook_events",
    "select=stripe_event_id,event_type,processed,processing_error,received_at,processed_at,payload&order=received_at.desc&limit=100",
  ),
]);
const matchingWebhookRows = webhookRows.filter((row) =>
  JSON.stringify(row.payload ?? {}).includes(purchaseId),
);

const customerId = purchase.stripe_customer_id;
let stripeDiagnosticError = null;
let checkoutSessions = { data: [] };
try {
  checkoutSessions = stripe && customerId
    ? await stripe.checkout.sessions.list({ customer: customerId, limit: 100 })
    : { data: [] };
} catch (error) {
  stripeDiagnosticError = `${error.code ?? error.type}: ${error.message}`;
  const directSessionIds = [
    purchase.stripe_checkout_session_id,
    purchase.monthly_checkout_session_id,
    purchase.annual_checkout_session_id,
  ].filter(Boolean);
  const directSessions = await Promise.all(
    [...new Set(directSessionIds)].map(async (id) => {
      try {
        return await stripe?.checkout.sessions.retrieve(id);
      } catch {
        return null;
      }
    }),
  );
  checkoutSessions = { data: directSessions.filter(Boolean) };
}
const matchingSessions = checkoutSessions.data.filter(
  (session) => session.metadata?.purchase_id === purchaseId,
);
let stripeSubscriptions = { data: [] };
try {
  stripeSubscriptions = stripe && customerId
    ? await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 100 })
    : { data: [] };
} catch (error) {
  stripeDiagnosticError ??= `${error.code ?? error.type}: ${error.message}`;
  const directSubscriptionIds = [
    purchase.stripe_subscription_id,
    ...subscriptions.map((subscription) => subscription.stripe_subscription_id),
  ].filter(Boolean);
  const directSubscriptions = await Promise.all(
    [...new Set(directSubscriptionIds)].map(async (id) => {
      try {
        return await stripe?.subscriptions.retrieve(id);
      } catch {
        return null;
      }
    }),
  );
  stripeSubscriptions = { data: directSubscriptions.filter(Boolean) };
}
const matchingSubscriptions = stripeSubscriptions.data.filter(
  (subscription) => subscription.metadata?.purchase_id === purchaseId,
);

console.log(JSON.stringify({
  purchase: {
    id: purchase.id,
    offer_id: purchase.offer_id,
    tenant_id: purchase.tenant_id,
    status: purchase.status,
    checkout_state: purchase.checkout_state ?? "COLUMN_NOT_PRESENT_OR_NULL",
    stripe_checkout_session_id: purchase.stripe_checkout_session_id,
    monthly_checkout_session_id:
      purchase.monthly_checkout_session_id ?? "COLUMN_NOT_PRESENT_OR_NULL",
    annual_checkout_session_id:
      purchase.annual_checkout_session_id ?? "COLUMN_NOT_PRESENT_OR_NULL",
    stripe_customer_id: purchase.stripe_customer_id,
    stripe_subscription_id: purchase.stripe_subscription_id,
    recurring_total_cents: purchase.recurring_total_cents,
    annual_recurring_total_cents:
      purchase.annual_recurring_total_cents ?? "COLUMN_NOT_PRESENT_OR_NULL",
    purchased_at: purchase.purchased_at,
  },
  purchase_items: items.map((item) => ({
    id: item.id,
    name: item.name,
    billing_type: item.billing_type,
    billing_interval: item.billing_interval,
    service_status: item.service_status,
    stripe_product_id: item.stripe_product_id,
    stripe_price_id: item.stripe_price_id,
  })),
  offer: offerRows[0]
    ? {
        id: offerRows[0].id,
        status: offerRows[0].status,
        recurring_total_cents: offerRows[0].recurring_total_cents,
        annual_recurring_total_cents: offerRows[0].annual_recurring_total_cents,
      }
    : null,
  offer_items: offerItems.map((item) => ({
    id: item.id,
    item_type: item.item_type,
    name: item.name,
    unit_amount_cents: item.unit_amount_cents,
    billing_type: item.billing_type,
    billing_interval: item.billing_interval,
    is_selected: item.is_selected,
    stripe_product_id: item.stripe_product_id,
    stripe_price_id: item.stripe_price_id,
    stripe_coupon_id: item.stripe_coupon_id,
    metadata: item.metadata,
  })),
  tenant_subscriptions: subscriptions.map((subscription) => ({
    id: subscription.id,
    stripe_subscription_id: subscription.stripe_subscription_id,
    subscription_status: subscription.subscription_status,
    stripe_price_id: subscription.stripe_price_id,
    current_period_start: subscription.current_period_start,
    current_period_end: subscription.current_period_end,
  })),
  stripe_checkout_sessions: matchingSessions.map((session) => ({
    id: session.id,
    status: session.status,
    payment_status: session.payment_status,
    customer: session.customer,
    subscription: session.subscription,
    success_url: session.success_url,
    cancel_url: session.cancel_url,
    metadata: session.metadata,
  })),
  stripe_subscriptions: matchingSubscriptions.map((subscription) => ({
    id: subscription.id,
    status: subscription.status,
    metadata: subscription.metadata,
    items: subscription.items.data.map((item) => ({
      id: item.id,
      price_id: item.price.id,
      unit_amount: item.price.unit_amount,
      interval: item.price.recurring?.interval,
      interval_count: item.price.recurring?.interval_count,
      quantity: item.quantity,
    })),
  })),
  webhook_events: matchingWebhookRows.map((row) => ({
    stripe_event_id: row.stripe_event_id,
    event_type: row.event_type,
    processed: row.processed,
    processing_error: row.processing_error,
    received_at: row.received_at,
    processed_at: row.processed_at,
    session:
      row.event_type.startsWith("checkout.session.") && row.payload?.data?.object
        ? {
            id: row.payload.data.object.id,
            status: row.payload.data.object.status,
            payment_status: row.payload.data.object.payment_status,
            success_url: row.payload.data.object.success_url,
            cancel_url: row.payload.data.object.cancel_url,
            metadata: row.payload.data.object.metadata,
          }
        : null,
  })),
  stripe_diagnostic_error: stripeDiagnosticError,
}, null, 2));
