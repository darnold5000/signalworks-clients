import type { SupabaseClient } from "@supabase/supabase-js";
import { checkConfiguredSite } from "@/lib/site-health/checker";
import type {
  LaunchChecklistState,
  SiteHealthRecord,
  SiteHealthResult,
  SiteHealthSite,
} from "@/lib/site-health/types";
import { createClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/supabase/tables";

type PortalSettings = { website_url?: string | null; domain?: string | null };
type SiteRow = {
  id: string;
  slug: string;
  display_name: string;
  tenant_portal_settings?: PortalSettings | PortalSettings[] | null;
  tenant_site_health?: SiteHealthRecord | SiteHealthRecord[] | null;
};

function first<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

export function configuredSiteUrl(settings: PortalSettings | null): string | null {
  const raw = settings?.website_url?.trim() || settings?.domain?.trim();
  if (!raw) return null;
  return raw.includes("://") ? raw : `https://${raw}`;
}

export async function listSiteHealthSites(
  client?: SupabaseClient,
): Promise<SiteHealthSite[]> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase
    .from(TABLES.tenants)
    .select(`
      id, slug, display_name,
      tenant_portal_settings (website_url, domain),
      tenant_site_health (*)
    `)
    .in("platform_category", ["services", "internal"])
    .order("display_name");

  if (error) throw new Error(`Could not load Site Health: ${error.message}`);
  return ((data ?? []) as unknown as SiteRow[]).map(mapSiteRow);
}

export async function getSiteHealthSite(
  tenantId: string,
  client?: SupabaseClient,
): Promise<SiteHealthSite | null> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase
    .from(TABLES.tenants)
    .select(`
      id, slug, display_name,
      tenant_portal_settings (website_url, domain),
      tenant_site_health (*)
    `)
    .eq("id", tenantId)
    .maybeSingle();
  if (error) throw new Error(`Could not load Site Health: ${error.message}`);
  return data ? mapSiteRow(data as unknown as SiteRow) : null;
}

export async function runSiteHealthCheck(
  tenantId: string,
  client: SupabaseClient,
): Promise<SiteHealthResult | null> {
  const site = await getSiteHealthSite(tenantId, client);
  if (!site) throw new Error("Client website was not found.");

  if (!site.configuredUrl) {
    const { error } = await client.from(TABLES.tenantSiteHealth).upsert({
      tenant_id: tenantId,
      last_check_status: "not_configured",
      last_checked_at: new Date().toISOString(),
      last_check_duration_ms: 0,
      last_check_results: {},
    });
    if (error) throw new Error(`Could not save Site Health: ${error.message}`);
    return null;
  }

  let result: SiteHealthResult;
  try {
    result = await checkConfiguredSite(site.configuredUrl);
  } catch (caught) {
    const checkedAt = new Date().toISOString();
    const message = caught instanceof Error ? caught.message : "Site check failed.";
    const { error } = await client.from(TABLES.tenantSiteHealth).upsert({
      tenant_id: tenantId,
      last_check_status: "error",
      last_checked_at: checkedAt,
      last_check_duration_ms: 0,
      last_check_results: { error: message, checkedAt },
    });
    if (error) throw new Error(`Could not save Site Health: ${error.message}`);
    return null;
  }
  const { error } = await client.from(TABLES.tenantSiteHealth).upsert({
    tenant_id: tenantId,
    last_check_status: result.status,
    last_checked_at: result.checkedAt,
    last_check_duration_ms: result.durationMs,
    last_check_results: result,
  });
  if (error) throw new Error(`Could not save Site Health: ${error.message}`);
  return result;
}

export async function updateSiteHealthSettings(
  tenantId: string,
  input: {
    launchChecklist?: LaunchChecklistState;
    searchConsoleStatus?: SiteHealthRecord["search_console_status"];
    searchConsoleProperty?: string | null;
  },
  client: SupabaseClient,
) {
  const update: Record<string, unknown> = { tenant_id: tenantId };
  if (input.launchChecklist) update.launch_checklist = input.launchChecklist;
  if (input.searchConsoleStatus) update.search_console_status = input.searchConsoleStatus;
  if (input.searchConsoleProperty !== undefined) {
    update.search_console_property = input.searchConsoleProperty;
  }
  const { data, error } = await client
    .from(TABLES.tenantSiteHealth)
    .upsert(update)
    .select("*")
    .single();
  if (error) throw new Error(`Could not save Site Health settings: ${error.message}`);
  return data;
}

function mapSiteRow(row: SiteRow): SiteHealthSite {
  const settings = first(row.tenant_portal_settings);
  return {
    tenantId: row.id,
    name: row.display_name,
    slug: row.slug,
    configuredUrl: configuredSiteUrl(settings),
    configuredDomain: settings?.domain ?? null,
    record: first(row.tenant_site_health),
  };
}
