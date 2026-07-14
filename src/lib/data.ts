import { cache } from "react";
import {
  DEMO_CLIENTS,
  DEMO_DOCUMENTS,
  DEMO_REQUESTS,
} from "@/lib/demo-data";
import { getCurrentProfile } from "@/lib/auth";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { Client, Document, ServiceRequest } from "@/lib/types";

export const getAccessibleClients = cache(async (): Promise<Client[]> => {
  const profile = await getCurrentProfile();
  if (!profile) return [];

  if (!isSupabaseConfigured()) {
    if (profile.role === "admin") return DEMO_CLIENTS;
    return DEMO_CLIENTS.filter((c) => c.slug === "bloom-studio-salon");
  }

  const supabase = await createClient();

  if (profile.role === "admin") {
    const { data } = await supabase
      .from("clients")
      .select("*")
      .order("business_name");
    return (data as Client[]) ?? [];
  }

  const { data: memberships } = await supabase
    .from("client_members")
    .select("client_id")
    .eq("profile_id", profile.id);

  const ids = (memberships ?? []).map((m) => m.client_id as string);
  if (ids.length === 0) return [];

  const { data } = await supabase
    .from("clients")
    .select("*")
    .in("id", ids)
    .order("business_name");

  return (data as Client[]) ?? [];
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
  clientId: string,
): Promise<ServiceRequest[]> {
  if (!isSupabaseConfigured()) {
    return DEMO_REQUESTS.filter((r) => r.client_id === clientId).sort(
      (a, b) => b.created_at.localeCompare(a.created_at),
    );
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("service_requests")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  return (data as ServiceRequest[]) ?? [];
}

export async function getDocumentsForClient(
  clientId: string,
): Promise<Document[]> {
  if (!isSupabaseConfigured()) {
    return DEMO_DOCUMENTS.filter((d) => d.client_id === clientId);
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("documents")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  return (data as Document[]) ?? [];
}

export function computeMrrCents(clients: Client[]): number {
  return clients
    .filter(
      (c) =>
        c.subscription_status === "active" ||
        c.subscription_status === "trialing",
    )
    .reduce((sum, c) => sum + c.monthly_price_cents, 0);
}
