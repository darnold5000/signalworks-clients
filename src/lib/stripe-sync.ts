import type Stripe from "stripe";
import {
  getPlan,
  getPlanKeyFromPriceId,
  getPriceIdForPlan,
  type PlanKey,
} from "@/lib/plans";
import { createServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { TABLES } from "@/lib/supabase/tables";
import type { ClientStatus, SubscriptionStatus } from "@/lib/types";

function mapSubStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case "active":
    case "trialing":
    case "past_due":
    case "canceled":
    case "incomplete":
    case "unpaid":
      return status;
    default:
      return "none";
  }
}

function customerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer,
) {
  return typeof customer === "string" ? customer : customer.id;
}

function resolveTenantId(session: Stripe.Checkout.Session): string | null {
  return (
    session.client_reference_id ||
    session.metadata?.tenant_id ||
    session.metadata?.client_id ||
    null
  );
}

async function upsertTenantSubscription(
  supabase: ReturnType<typeof createServiceClient>,
  args: {
    tenantId: string;
    stripeSubscriptionId: string | null;
    payload: Record<string, unknown>;
  },
) {
  if (args.stripeSubscriptionId) {
    await supabase.from(TABLES.tenantSubscriptions).upsert(
      {
        tenant_id: args.tenantId,
        stripe_subscription_id: args.stripeSubscriptionId,
        ...args.payload,
      },
      { onConflict: "stripe_subscription_id" },
    );
    return;
  }

  const { data: existing } = await supabase
    .from(TABLES.tenantSubscriptions)
    .select("id")
    .eq("tenant_id", args.tenantId)
    .is("stripe_subscription_id", null)
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    await supabase
      .from(TABLES.tenantSubscriptions)
      .update(args.payload)
      .eq("id", existing.id);
    return;
  }

  await supabase.from(TABLES.tenantSubscriptions).insert({
    tenant_id: args.tenantId,
    ...args.payload,
  });
}

export async function syncClientFromCheckoutSession(
  session: Stripe.Checkout.Session,
) {
  if (!isSupabaseConfigured()) return;
  if (session.mode !== "subscription") return;

  const supabase = createServiceClient();
  const tenantId = resolveTenantId(session);
  const customer =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id;
  const subscription =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;
  const planKey = session.metadata?.plan_key;
  const plan = planKey ? getPlan(planKey) : undefined;

  const subscriptionPayload: Record<string, unknown> = {
    stripe_customer_id: customer ?? null,
    stripe_subscription_id: subscription ?? null,
    subscription_status: "active",
  };

  if (plan && planKey) {
    const priceId = getPriceIdForPlan(planKey as PlanKey);
    if (priceId) subscriptionPayload.stripe_price_id = priceId;
  }

  const tenantStatus: ClientStatus = "active";

  if (tenantId) {
    await upsertTenantSubscription(supabase, {
      tenantId,
      stripeSubscriptionId: subscription ?? null,
      payload: subscriptionPayload,
    });

    await supabase
      .from(TABLES.tenants)
      .update({ status: tenantStatus })
      .eq("id", tenantId);

    if (plan) {
      await supabase
        .from(TABLES.tenantPortalSettings)
        .update({
          plan_name: plan.name,
          monthly_price_cents: plan.monthlyPriceCents,
        })
        .eq("tenant_id", tenantId);
    }
  } else if (customer) {
    if (subscription) {
      await supabase
        .from(TABLES.tenantSubscriptions)
        .update(subscriptionPayload)
        .eq("stripe_subscription_id", subscription);
    } else {
      await supabase
        .from(TABLES.tenantSubscriptions)
        .update(subscriptionPayload)
        .eq("stripe_customer_id", customer);
    }

    const { data: subRow } = await supabase
      .from(TABLES.tenantSubscriptions)
      .select("tenant_id")
      .eq("stripe_customer_id", customer)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subRow?.tenant_id) {
      await supabase
        .from(TABLES.tenants)
        .update({ status: tenantStatus })
        .eq("id", subRow.tenant_id);
    }
  }
}

export async function syncClientFromSubscription(sub: Stripe.Subscription) {
  if (!isSupabaseConfigured()) return;
  const supabase = createServiceClient();
  const item = sub.items.data[0];
  const price = item?.price;
  const periodEnd = item?.current_period_end;
  const priceId = typeof price === "string" ? price : price?.id;
  const planKey =
    (sub.metadata?.plan_key as string | undefined) ||
    (priceId ? getPlanKeyFromPriceId(priceId) : null);
  const plan = planKey ? getPlan(planKey) : undefined;

  const subscriptionPayload: Record<string, unknown> = {
    stripe_subscription_id: sub.id,
    stripe_customer_id: customerId(sub.customer),
    stripe_price_id: priceId ?? null,
    subscription_status: mapSubStatus(sub.status),
    current_period_end: periodEnd
      ? new Date(periodEnd * 1000).toISOString()
      : null,
  };

  const tenantId = sub.metadata?.tenant_id || sub.metadata?.client_id;
  const tenantStatus: ClientStatus =
    sub.status === "past_due"
      ? "past_due"
      : sub.status === "canceled"
        ? "canceled"
        : "active";

  if (tenantId) {
    await upsertTenantSubscription(supabase, {
      tenantId,
      stripeSubscriptionId: sub.id,
      payload: subscriptionPayload,
    });

    await supabase
      .from(TABLES.tenants)
      .update({ status: tenantStatus })
      .eq("id", tenantId);

    if (plan) {
      await supabase
        .from(TABLES.tenantPortalSettings)
        .update({
          plan_name: plan.name,
          monthly_price_cents: plan.monthlyPriceCents,
        })
        .eq("tenant_id", tenantId);
    }
    return;
  }

  await supabase
    .from(TABLES.tenantSubscriptions)
    .update(subscriptionPayload)
    .eq("stripe_subscription_id", sub.id);

  const { data: subRow } = await supabase
    .from(TABLES.tenantSubscriptions)
    .select("tenant_id")
    .eq("stripe_customer_id", customerId(sub.customer))
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (subRow?.tenant_id) {
    await supabase
      .from(TABLES.tenants)
      .update({ status: tenantStatus })
      .eq("id", subRow.tenant_id);
  }
}

export async function syncTenantBillingStatus(
  stripeCustomerId: string,
  subscriptionStatus: SubscriptionStatus,
  tenantStatus: ClientStatus,
) {
  if (!isSupabaseConfigured()) return;

  const supabase = createServiceClient();
  const { data: subRow } = await supabase
    .from(TABLES.tenantSubscriptions)
    .select("tenant_id")
    .eq("stripe_customer_id", stripeCustomerId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!subRow?.tenant_id) return;

  await supabase
    .from(TABLES.tenantSubscriptions)
    .update({ subscription_status: subscriptionStatus })
    .eq("stripe_customer_id", stripeCustomerId);

  await supabase
    .from(TABLES.tenants)
    .update({ status: tenantStatus })
    .eq("id", subRow.tenant_id);
}
