import { canDeletePortalClientTenant } from "@/lib/admin/platform-tenant-guards";
import { createServiceClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/supabase/tables";

export type DeletePortalClientResult =
  | { ok: true; displayName: string }
  | { ok: false; error: string };

export async function deletePortalClientTenant(args: {
  tenantId: string;
  confirmSlug: string;
}): Promise<DeletePortalClientResult> {
  const supabase = createServiceClient();

  const { data: tenant, error: loadError } = await supabase
    .from(TABLES.tenants)
    .select("id, slug, display_name, platform_category")
    .eq("id", args.tenantId)
    .maybeSingle();

  if (loadError) {
    console.error("deletePortalClientTenant.load", loadError);
    return { ok: false, error: "Could not load client." };
  }
  if (!tenant) {
    return { ok: false, error: "Client not found." };
  }

  const slug = String(tenant.slug);
  const platformCategory = String(tenant.platform_category ?? "services");

  if (slug !== args.confirmSlug.trim()) {
    return {
      ok: false,
      error: "Type the client slug exactly to confirm deletion.",
    };
  }

  const eligibility = canDeletePortalClientTenant({
    slug,
    platformCategory,
  });
  if (!eligibility.allowed) {
    return { ok: false, error: eligibility.reason };
  }

  const { error: deleteError } = await supabase
    .from(TABLES.tenants)
    .delete()
    .eq("id", args.tenantId);

  if (deleteError) {
    console.error("deletePortalClientTenant.delete", deleteError);
    if (deleteError.code === "23503") {
      return {
        ok: false,
        error:
          "This tenant is still referenced by other platform data (for example MA5 or training). Clean up those records first, or ask engineering for help.",
      };
    }
    return {
      ok: false,
      error: deleteError.message || "Could not delete client.",
    };
  }

  return {
    ok: true,
    displayName: String(tenant.display_name),
  };
}
