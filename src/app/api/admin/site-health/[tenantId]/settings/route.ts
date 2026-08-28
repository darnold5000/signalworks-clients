import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  jsonWithSessionCookies,
  requireAdminApiAuth,
} from "@/lib/admin/require-admin-api-auth";
import { MANUAL_CHECKLIST_KEYS } from "@/lib/site-health/types";
import {
  setSiteHealthMonitoring,
  updateSiteHealthSettings,
} from "@/lib/site-health/service";

const checklistShape = Object.fromEntries(
  MANUAL_CHECKLIST_KEYS.map((key) => [key, z.boolean().optional()]),
) as Record<(typeof MANUAL_CHECKLIST_KEYS)[number], z.ZodOptional<z.ZodBoolean>>;

const schema = z.object({
  launchChecklist: z.object(checklistShape).optional(),
  searchConsoleStatus: z.enum(["not_configured", "manual_setup", "connected"]).optional(),
  searchConsoleProperty: z.string().trim().max(500).nullable().optional(),
  monitoringEnabled: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const auth = await requireAdminApiAuth(request);
  if (!auth.ok) return auth.response;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonWithSessionCookies(auth.sessionCookies, { error: "Invalid Site Health settings." }, { status: 400 });
  }
  const { tenantId } = await params;
  try {
    if (parsed.data.monitoringEnabled !== undefined) {
      await setSiteHealthMonitoring(
        tenantId,
        parsed.data.monitoringEnabled,
        auth.supabase,
      );
    }
    const hasRecordSettings = Boolean(
      parsed.data.launchChecklist
      || parsed.data.searchConsoleStatus
      || parsed.data.searchConsoleProperty !== undefined,
    );
    const record = hasRecordSettings
      ? await updateSiteHealthSettings(tenantId, parsed.data, auth.supabase)
      : null;
    return jsonWithSessionCookies(auth.sessionCookies, { record });
  } catch (error) {
    return jsonWithSessionCookies(
      auth.sessionCookies,
      { error: error instanceof Error ? error.message : "Save failed." },
      { status: 500 },
    );
  }
}
