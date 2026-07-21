import { cache } from "react";
import {
  DEMO_CLIENTS,
  DEMO_DOCUMENTS,
  DEMO_REQUESTS,
} from "@/lib/demo-data";
import { isPlatformAdmin } from "@/lib/auth";
import { mapTenantToClient, TENANT_PORTAL_SELECT } from "@/lib/tenant-mapper";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { TABLES } from "@/lib/supabase/tables";
import type { Client, Document, ServiceRequest } from "@/lib/types";

export const getAccessibleClients = cache(async (): Promise<Client[]> => {
  if (!isSupabaseConfigured()) return DEMO_CLIENTS;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  if (await isPlatformAdmin()) {
    const { data } = await supabase
      .from(TABLES.tenants)
      .select(TENANT_PORTAL_SELECT)
      .neq("platform_category", "internal")
      .order("display_name");

    return (data ?? []).map((row) => mapTenantToClient(row));
  }

  const { data: memberships } = await supabase
    .from(TABLES.tenantMemberships)
    .select("tenant_id")
    .eq("user_id", user.id)
    .eq("status", "active");

  const tenantIds = (memberships ?? []).map((m) => m.tenant_id as string);
  if (tenantIds.length === 0) return [];

  const { data } = await supabase
    .from(TABLES.tenants)
    .select(TENANT_PORTAL_SELECT)
    .in("id", tenantIds)
    .order("display_name");

  return (data ?? []).map((row) => mapTenantToClient(row));
});

export const getPrimaryClient = cache(async (): Promise<Client | null> => {
  const clients = await getAccessibleClients();
  return clients[0] ?? null;
});

export const getClientById = cache(
  async (id: string): Promise<Client | null> => {
    const clients = await getAccessibleClients();
    return clients.find((c) => c.id === id) ?? null;
  },
);

export async function getRequestsForClient(
  tenantId: string,
): Promise<ServiceRequest[]> {
  if (!isSupabaseConfigured()) {
    return DEMO_REQUESTS.filter((r) => r.tenant_id === tenantId).sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from(TABLES.serviceRequests)
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  return (data as ServiceRequest[]) ?? [];
}

export async function getDocumentsForClient(
  tenantId: string,
): Promise<Document[]> {
  if (!isSupabaseConfigured()) {
    return DEMO_DOCUMENTS.filter((d) => d.tenant_id === tenantId);
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from(TABLES.documents)
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  return (data as Document[]) ?? [];
}
