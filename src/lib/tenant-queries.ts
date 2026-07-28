import type { SupabaseClient } from "@supabase/supabase-js";
import { isPlatformAppTenantSlug } from "@/lib/admin/platform-tenant-guards";
import {
  TENANT_PORTAL_SELECT,
  TENANT_PORTAL_SELECT_COMPAT,
} from "@/lib/tenant-mapper";
import { TABLES } from "@/lib/supabase/tables";

type TenantListRow = Record<string, unknown>;

function portalAdminClientRows(rows: TenantListRow[]): TenantListRow[] {
  return rows.filter((row) => {
    const slug = typeof row.slug === "string" ? row.slug : "";
    return !isPlatformAppTenantSlug(slug);
  });
}

export async function fetchTenantRowsForAdmin(
  supabase: SupabaseClient,
): Promise<TenantListRow[]> {
  const baseQuery = () =>
    supabase
      .from(TABLES.tenants)
      .select(TENANT_PORTAL_SELECT)
      .neq("platform_category", "internal")
      .order("display_name");

  const { data, error } = await baseQuery();

  if (!error) {
    return portalAdminClientRows((data ?? []) as TenantListRow[]);
  }

  console.error(
    "[signalworks-clients] tenant list query failed (full select); retrying compat select. Apply migration 019 on this Supabase project.",
    error.message,
  );

  const { data: compatData, error: compatError } = await supabase
    .from(TABLES.tenants)
    .select(TENANT_PORTAL_SELECT_COMPAT)
    .neq("platform_category", "internal")
    .order("display_name");

  if (compatError) {
    console.error(
      "[signalworks-clients] tenant list query failed (compat select):",
      compatError.message,
    );
    return [];
  }

  return portalAdminClientRows((compatData ?? []) as TenantListRow[]);
}

export async function fetchTenantRowsForMember(
  supabase: SupabaseClient,
  tenantIds: string[],
): Promise<TenantListRow[]> {
  if (tenantIds.length === 0) return [];

  const { data, error } = await supabase
    .from(TABLES.tenants)
    .select(TENANT_PORTAL_SELECT)
    .in("id", tenantIds)
    .order("display_name");

  if (!error) {
    return (data ?? []) as TenantListRow[];
  }

  console.error(
    "[signalworks-clients] member tenant query failed (full select); retrying compat.",
    error.message,
  );

  const { data: compatData, error: compatError } = await supabase
    .from(TABLES.tenants)
    .select(TENANT_PORTAL_SELECT_COMPAT)
    .in("id", tenantIds)
    .order("display_name");

  if (compatError) {
    console.error(
      "[signalworks-clients] member tenant query failed (compat):",
      compatError.message,
    );
    return [];
  }

  return (compatData ?? []) as TenantListRow[];
}
