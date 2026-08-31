import { cache } from "react";
import type {
  TenantActivityLogEntry,
  ClientOfferStatus,
  TenantContact,
  TenantInternalNote,
  TenantInternalStatus,
  TenantOnboardingStatus,
  TenantProfile,
  TenantTechnicalProfile,
} from "@/lib/database/phase1-types";
import { getTenantOwnerInviteTarget } from "@/lib/admin/client-invite-link";
import type { TenantOwnerInviteTarget } from "@/lib/admin/client-invite-link";
import { getClientById, getAccessibleClients, getRequestsForClient } from "@/lib/data";
import type { Client, ServiceRequest } from "@/lib/types";
import {
  createClient,
  createServiceClient,
  isServiceRoleConfigured,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import { TABLES } from "@/lib/supabase/tables";
import {
  aggregateOperationsInventory,
  infrastructureSnapshotFromProfile,
  type TechnicalInfrastructureSnapshot,
} from "@/lib/technical/operations-inventory";
import {
  calculateRecurringFinancials,
  legacyRecurringFinancials,
  recurringSourcesFromPurchases,
  recurringFinancialsFromStripeSnapshot,
  type RecurringFinancials,
  type RecurringFinancialSource,
} from "@/lib/admin/recurring-financials";
import { resolveAgreementAwareInternalStatus } from "@/lib/admin/agreement-status";
import { loadStripeBillingSnapshot } from "@/lib/admin/stripe-billing-snapshot";
import {
  resolveCommercialAccountSummary,
  type CommercialAccountSummary,
  type CommercialOffer,
  type CommercialPurchase,
  type CommercialSubscription,
} from "@/lib/admin/commercial-account-summary";

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex++;
      results[index] = await mapper(values[index]!);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, () => worker()),
  );
  return results;
}

export type AdminClientListItem = Client & {
  recurringFinancials: RecurringFinancials;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  internal_status: TenantInternalStatus | null;
  onboarding_status: TenantOnboardingStatus | null;
  last_activity_at: string | null;
  infrastructure: TechnicalInfrastructureSnapshot | null;
  infrastructureProfile: TenantTechnicalProfile | null;
  proposal_status: ClientOfferStatus | null;
  commercialSummary: CommercialAccountSummary;
};

export type AdminClientBundle = {
  client: Client;
  recurringFinancials: RecurringFinancials;
  profile: TenantProfile | null;
  technical: TenantTechnicalProfile | null;
  contacts: TenantContact[];
  internalNotes: TenantInternalNote[];
  activity: TenantActivityLogEntry[];
  requests: ServiceRequest[];
  owner: TenantOwnerInviteTarget | null;
  platformCategory: string;
  commercialSummary: CommercialAccountSummary;
};

export const INTERNAL_STATUS_FILTERS: TenantInternalStatus[] = [
  "prospect",
  "invited",
  "onboarding",
  "awaiting_agreement",
  "awaiting_payment",
  "active",
  "past_due",
  "paused",
  "canceled",
  "archived",
];

export const getAdminClientList = cache(
  async (): Promise<AdminClientListItem[]> => {
    const clients = await getAccessibleClients();
    if (!isSupabaseConfigured() || clients.length === 0) {
      return clients.map((client) => ({
        ...client,
        recurringFinancials: legacyRecurringFinancials(client.monthly_price_cents, client.estimated_infra_cost_cents),
        primary_contact_name: null,
        primary_contact_email: client.support_email,
        internal_status: client.status === "active" ? "active" : "onboarding",
        onboarding_status:
          client.status === "active" ? "onboarding_complete" : "invited",
        last_activity_at: client.updated_at,
        infrastructure: null,
        infrastructureProfile: null,
        proposal_status: null,
        commercialSummary: resolveCommercialAccountSummary({
          tenantStatus: client.status,
          offers: [],
          purchases: [],
          subscriptions: [],
          stripeSnapshot: null,
          recurringCostsCents: client.estimated_infra_cost_cents,
        }),
      }));
    }

    const supabase = await createClient();
    const tenantIds = clients.map((c) => c.id);

    const [{ data: profiles }, { data: contacts }, { data: activity }, { data: technicalRows }, { data: purchases }, { data: subscriptions }, { data: offers }] =
      await Promise.all([
        supabase
          .from(TABLES.tenantProfiles)
          .select("tenant_id, internal_status, onboarding_status, primary_contact_name, primary_contact_email")
          .in("tenant_id", tenantIds),
        supabase
          .from(TABLES.tenantContacts)
          .select("tenant_id, name, email, is_primary")
          .in("tenant_id", tenantIds)
          .eq("is_primary", true),
        supabase
          .from(TABLES.tenantActivityLog)
          .select("tenant_id, created_at")
          .in("tenant_id", tenantIds)
          .order("created_at", { ascending: false }),
        supabase
          .from(TABLES.tenantTechnicalProfiles)
          .select("*")
          .in("tenant_id", tenantIds),
        supabase
          .from(TABLES.purchases)
          .select("id, tenant_id, status, purchased_at, purchase_snapshot")
          .in("tenant_id", tenantIds),
        supabase
          .from(TABLES.tenantSubscriptions)
          .select("tenant_id, purchase_id, stripe_subscription_id, subscription_status")
          .in("tenant_id", tenantIds),
        supabase
          .from(TABLES.clientOffers)
          .select("*")
          .in("tenant_id", tenantIds)
          .order("created_at", { ascending: false }),
      ]);

    const offerIds = (offers ?? []).map((offer) => offer.id as string);
    const { data: offerItems } = offerIds.length
      ? await supabase
          .from(TABLES.clientOfferItems)
          .select("*")
          .in("offer_id", offerIds)
          .order("sort_order", { ascending: true })
      : { data: [] };
    const offerItemsByOffer = new Map<string, import("@/lib/database/phase1-types").ClientOfferItem[]>();
    for (const item of offerItems ?? []) {
      const offerId = item.offer_id as string;
      offerItemsByOffer.set(offerId, [
        ...(offerItemsByOffer.get(offerId) ?? []),
        item as import("@/lib/database/phase1-types").ClientOfferItem,
      ]);
    }

    const financialSourcesByTenant = new Map<string, RecurringFinancialSource[]>();
    for (const purchase of purchases ?? []) {
      const sources = recurringSourcesFromPurchases([purchase as Parameters<typeof recurringSourcesFromPurchases>[0][number]]);
      if (!sources.length) continue;
      const tenantId = purchase.tenant_id as string;
      financialSourcesByTenant.set(tenantId, [
        ...(financialSourcesByTenant.get(tenantId) ?? []),
        ...sources,
      ]);
    }

    const subscriptionIdsByTenant = new Map<string, string[]>();
    for (const subscription of subscriptions ?? []) {
      if (!["active", "trialing", "past_due"].includes(String(subscription.subscription_status))) continue;
      if (!subscription.stripe_subscription_id) continue;
      const tenantId = subscription.tenant_id as string;
      subscriptionIdsByTenant.set(tenantId, [
        ...(subscriptionIdsByTenant.get(tenantId) ?? []),
        subscription.stripe_subscription_id as string,
      ]);
    }
    const stripeEntries = await mapWithConcurrency(
      [...subscriptionIdsByTenant.entries()],
      4,
      async ([tenantId, subscriptionIds]) => [
        tenantId,
        await loadStripeBillingSnapshot(subscriptionIds),
      ] as const,
    );
    const stripeSnapshotByTenant = new Map(stripeEntries);

    const profileByTenant = new Map(
      (profiles ?? []).map((row) => [row.tenant_id as string, row]),
    );
    const contactByTenant = new Map(
      (contacts ?? []).map((row) => [row.tenant_id as string, row]),
    );
    const lastActivityByTenant = new Map<string, string>();
    for (const row of activity ?? []) {
      const tenantId = row.tenant_id as string;
      if (!lastActivityByTenant.has(tenantId)) {
        lastActivityByTenant.set(tenantId, row.created_at as string);
      }
    }
    const technicalByTenant = new Map(
      (technicalRows ?? []).map((row) => [
        row.tenant_id as string,
        row as TenantTechnicalProfile,
      ]),
    );
    const offerStatusesByTenant = new Map<string, ClientOfferStatus[]>();
    const offersByTenant = new Map<string, CommercialOffer[]>();
    for (const offer of offers ?? []) {
      const tenantId = offer.tenant_id as string;
      offerStatusesByTenant.set(tenantId, [
        ...(offerStatusesByTenant.get(tenantId) ?? []),
        offer.status as ClientOfferStatus,
      ]);
      offersByTenant.set(tenantId, [
        ...(offersByTenant.get(tenantId) ?? []),
        {
          ...(offer as unknown as CommercialOffer),
          items: offerItemsByOffer.get(offer.id as string) ?? [],
        },
      ]);
    }
    const purchasesByTenant = new Map<string, CommercialPurchase[]>();
    for (const purchase of purchases ?? []) {
      const tenantId = purchase.tenant_id as string;
      purchasesByTenant.set(tenantId, [
        ...(purchasesByTenant.get(tenantId) ?? []),
        purchase as unknown as CommercialPurchase,
      ]);
    }
    const subscriptionsByTenant = new Map<string, CommercialSubscription[]>();
    for (const subscription of subscriptions ?? []) {
      const tenantId = subscription.tenant_id as string;
      subscriptionsByTenant.set(tenantId, [
        ...(subscriptionsByTenant.get(tenantId) ?? []),
        subscription as CommercialSubscription,
      ]);
    }

    return clients.map((client) => {
      const profile = profileByTenant.get(client.id);
      const contact = contactByTenant.get(client.id);
      const technical = technicalByTenant.get(client.id) ?? null;
      const stripeSnapshot = stripeSnapshotByTenant.get(client.id);
      return {
        ...client,
        recurringFinancials:
          stripeSnapshot && stripeSnapshot.current.items.length > 0
            ? recurringFinancialsFromStripeSnapshot(
                stripeSnapshot,
                client.estimated_infra_cost_cents,
              )
            : financialSourcesByTenant.has(client.id)
              ? calculateRecurringFinancials(
                  financialSourcesByTenant.get(client.id)!,
                  client.estimated_infra_cost_cents,
                )
              : legacyRecurringFinancials(
                  client.monthly_price_cents,
                  client.estimated_infra_cost_cents,
                ),
        primary_contact_name:
          profile?.primary_contact_name ??
          (contact?.name as string | undefined) ??
          null,
        primary_contact_email:
          profile?.primary_contact_email ??
          (contact?.email as string | undefined) ??
          client.support_email,
        internal_status: resolveAgreementAwareInternalStatus({
          storedStatus:
            (profile?.internal_status as TenantInternalStatus | undefined) ?? null,
          tenantStatus: client.status,
          offerStatuses: offerStatusesByTenant.get(client.id) ?? [],
        }),
        onboarding_status:
          (profile?.onboarding_status as TenantOnboardingStatus | undefined) ??
          null,
        last_activity_at:
          lastActivityByTenant.get(client.id) ?? client.updated_at,
        infrastructure: infrastructureSnapshotFromProfile(technical),
        infrastructureProfile: technical,
        proposal_status: offerStatusesByTenant.get(client.id)?.[0] ?? null,
        commercialSummary: resolveCommercialAccountSummary({
          tenantStatus: client.status,
          offers: offersByTenant.get(client.id) ?? [],
          purchases: purchasesByTenant.get(client.id) ?? [],
          subscriptions: subscriptionsByTenant.get(client.id) ?? [],
          stripeSnapshot: stripeSnapshot ?? null,
          recurringCostsCents: client.estimated_infra_cost_cents,
        }),
      };
    });
  },
);

export const getAdminClientBundle = cache(
  async (tenantId: string): Promise<AdminClientBundle | null> => {
    const adminClient = (await getAdminClientList()).find((candidate) => candidate.id === tenantId);
    const client = adminClient ?? await getClientById(tenantId);
    if (!client) return null;
    const recurringFinancials = adminClient?.recurringFinancials ?? legacyRecurringFinancials(client.monthly_price_cents, client.estimated_infra_cost_cents);

    const requests = await getRequestsForClient(tenantId);

    if (!isSupabaseConfigured()) {
      return {
        client,
        recurringFinancials,
        profile: null,
        technical: null,
        contacts: [],
        internalNotes: [],
        activity: [],
        requests,
        owner: null,
        platformCategory: "services",
        commercialSummary: resolveCommercialAccountSummary({
          tenantStatus: client.status,
          offers: [],
          purchases: [],
          subscriptions: [],
          stripeSnapshot: null,
          recurringCostsCents: client.estimated_infra_cost_cents,
        }),
      };
    }

    const supabase = await createClient();
    const { data: tenantMeta } = await supabase
      .from(TABLES.tenants)
      .select("platform_category")
      .eq("id", tenantId)
      .maybeSingle();
    const platformCategory = String(
      tenantMeta?.platform_category ?? "services",
    );

    const [
      { data: profile },
      { data: technical },
      { data: contacts },
      { data: internalNotes },
      { data: activity },
    ] = await Promise.all([
      supabase
        .from(TABLES.tenantProfiles)
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle(),
      supabase
        .from(TABLES.tenantTechnicalProfiles)
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle(),
      supabase
        .from(TABLES.tenantContacts)
        .select("*")
        .eq("tenant_id", tenantId)
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: true }),
      supabase
        .from(TABLES.tenantInternalNotes)
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false }),
      supabase
        .from(TABLES.tenantActivityLog)
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    let owner: TenantOwnerInviteTarget | null = null;
    if (isServiceRoleConfigured()) {
      owner = await getTenantOwnerInviteTarget(createServiceClient(), tenantId, {
        checkSignIn: createServiceClient(),
      });
    }

    return {
      client,
      recurringFinancials,
      profile: profile
        ? {
            ...(profile as TenantProfile),
            internal_status:
              adminClient?.internal_status ??
              (profile.internal_status as TenantInternalStatus),
          }
        : null,
      technical: (technical as TenantTechnicalProfile | null) ?? null,
      contacts: (contacts as TenantContact[]) ?? [],
      internalNotes: (internalNotes as TenantInternalNote[]) ?? [],
      activity: (activity as TenantActivityLogEntry[]) ?? [],
      requests,
      owner,
      platformCategory,
      commercialSummary:
        adminClient?.commercialSummary ??
        resolveCommercialAccountSummary({
          tenantStatus: client.status,
          offers: [],
          purchases: [],
          subscriptions: [],
          stripeSnapshot: null,
          recurringCostsCents: client.estimated_infra_cost_cents,
        }),
    };
  },
);

export const getOperationsInventorySummary = cache(async () => {
  const list = await getAdminClientList();
  return aggregateOperationsInventory(
    list.map((c) => ({
      id: c.id,
      business_name: c.business_name,
      technical: c.infrastructureProfile,
    })),
  );
});
