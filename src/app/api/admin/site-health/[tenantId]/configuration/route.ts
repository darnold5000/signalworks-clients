import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  jsonWithSessionCookies,
  requireAdminApiAuth,
} from "@/lib/admin/require-admin-api-auth";
import { normalizeAuditUrl } from "@/lib/audit/url/normalize";
import { TABLES } from "@/lib/supabase/tables";

const schema = z.object({
  productionUrl: z.string().trim().min(1).max(500),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const auth = await requireAdminApiAuth(request);
  if (!auth.ok) return auth.response;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonWithSessionCookies(
      auth.sessionCookies,
      { error: "Enter a valid production website URL." },
      { status: 400 },
    );
  }

  try {
    const { tenantId } = await params;
    const normalized = normalizeAuditUrl(parsed.data.productionUrl);
    const productionUrl = new URL(normalized.normalizedUrl);
    productionUrl.pathname = "/";
    productionUrl.search = "";
    const { data, error } = await auth.supabase
      .from(TABLES.tenantPortalSettings)
      .upsert({
        tenant_id: tenantId,
        website_url: productionUrl.toString(),
        domain: normalized.hostname.replace(/^www\./, ""),
      })
      .select("website_url, domain")
      .single();
    if (error) throw new Error(error.message);
    return jsonWithSessionCookies(auth.sessionCookies, { settings: data });
  } catch (error) {
    return jsonWithSessionCookies(
      auth.sessionCookies,
      { error: error instanceof Error ? error.message : "Configuration failed." },
      { status: 400 },
    );
  }
}
