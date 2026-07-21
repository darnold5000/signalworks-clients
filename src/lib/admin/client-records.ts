import { cache } from "react";
import type {
  TenantActivityLogEntry,
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

export type AdminClientListItem = Client & {
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  internal_status: TenantInternalStatus | null;
  onboarding_status: TenantOnboardingStatus | null;
  last_activity_at: string | null;
};

export type AdminClientBundle = {
  client: Client;
  profile: TenantProfile | null;
  technical: TenantTechnicalProfile | null;
  contacts: TenantContact[];
  internalNotes: TenantInternalNote[];
  activity: TenantActivityLogEntry[];
  requests: ServiceRequest[];
  owner: TenantOwnerInviteTarget | null;
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
        primary_contact_name: null,
        primary_contact_email: client.support_email,
        internal_status: client.status === "active" ? "active" : "onboarding",
        onboarding_status:
          client.status === "active" ? "onboarding_complete" : "invited",
        last_activity_at: client.updated_at,
      }));
    }

    const supabase = await createClient();
    const tenantIds = clients.map((c) => c.id);

    const [{ data: profiles }, { data: contacts }, { data: activity }] =
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
      ]);

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

    return clients.map((client) => {
      const profile = profileByTenant.get(client.id);
      const contact = contactByTenant.get(client.id);
      return {
        ...client,
        primary_contact_name:
          profile?.primary_contact_name ??
          (contact?.name as string | undefined) ??
          null,
        primary_contact_email:
          profile?.primary_contact_email ??
          (contact?.email as string | undefined) ??
          client.support_email,
        internal_status:
          (profile?.internal_status as TenantInternalStatus | undefined) ??
          null,
        onboarding_status:
          (profile?.onboarding_status as TenantOnboardingStatus | undefined) ??
          null,
        last_activity_at:
          lastActivityByTenant.get(client.id) ?? client.updated_at,
      };
    });
  },
);

export const getAdminClientBundle = cache(
  async (tenantId: string): Promise<AdminClientBundle | null> => {
    const client = await getClientById(tenantId);
    if (!client) return null;

    const requests = await getRequestsForClient(tenantId);

    if (!isSupabaseConfigured()) {
      return {
        client,
        profile: null,
        technical: null,
        contacts: [],
        internalNotes: [],
        activity: [],
        requests,
        owner: null,
      };
    }

    const supabase = await createClient();
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
      profile: (profile as TenantProfile | null) ?? null,
      technical: (technical as TenantTechnicalProfile | null) ?? null,
      contacts: (contacts as TenantContact[]) ?? [],
      internalNotes: (internalNotes as TenantInternalNote[]) ?? [],
      activity: (activity as TenantActivityLogEntry[]) ?? [],
      requests,
      owner,
    };
  },
);
