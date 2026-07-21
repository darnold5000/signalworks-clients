import type { ActivityActorType } from "@/lib/database/phase1-types";
import { createServiceClient, isServiceRoleConfigured } from "@/lib/supabase/server";
import { TABLES } from "@/lib/supabase/tables";

export async function logTenantActivity(args: {
  tenantId: string;
  actorUserId?: string | null;
  actorType: ActivityActorType;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  summary: string;
  metadata?: Record<string, unknown>;
}) {
  if (!isServiceRoleConfigured()) return;

  const supabase = createServiceClient();
  await supabase.from(TABLES.tenantActivityLog).insert({
    tenant_id: args.tenantId,
    actor_user_id: args.actorUserId ?? null,
    actor_type: args.actorType,
    action: args.action,
    entity_type: args.entityType ?? null,
    entity_id: args.entityId ?? null,
    summary: args.summary,
    metadata: args.metadata ?? {},
  });
}
