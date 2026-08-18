"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isPlatformAdmin } from "@/lib/auth";
import {
  demoBulkDeletePipelineClients,
  demoCreatePipelineClient,
  demoDeletePipelineClient,
  demoGetPipelineClient,
  demoGetPipelineClients,
  demoUpdatePipelineClient,
} from "@/lib/pipeline/demo-store";
import { getSignalWorksTenantId } from "@/lib/pipeline/internal-tenant";
import {
  LEGACY_PIPELINE_TAGS,
  PIPELINE_TAGS,
  type ClientPipelineRecord,
  type PipelineStatus,
  type PipelineTag,
} from "@/lib/pipeline/types";
import {
  pipelineClientInputSchema,
  pipelineLastContactUpdateSchema,
  pipelineStatusUpdateSchema,
  type PipelineClientInput,
} from "@/lib/pipeline/validation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { TABLES } from "@/lib/supabase/tables";

export type PipelineActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const PIPELINE_ERRORS = {
  create: "Could not create client. Please try again.",
  update: "Could not update client. Please try again.",
  updateStatus: "Could not update status. Please try again.",
  updateLastContact: "Could not update last contact. Please try again.",
  delete: "Could not delete client. Please try again.",
  bulkDelete: "Could not delete the selected clients. Please try again.",
  notFound: "Client not found",
} as const;

const PIPELINE_TAG_SET = new Set<string>([
  ...PIPELINE_TAGS,
  ...LEGACY_PIPELINE_TAGS,
]);

async function requirePipelineAdmin(): Promise<void> {
  if (!(await isPlatformAdmin())) {
    throw new Error("Unauthorized");
  }
}

function revalidatePipeline() {
  revalidatePath("/admin/pipeline");
  revalidatePath("/admin/pipeline/[id]", "page");
}

function normalizeTags(value: unknown): PipelineTag[] {
  if (!Array.isArray(value)) return [];
  return value.filter((tag): tag is PipelineTag =>
    typeof tag === "string" && PIPELINE_TAG_SET.has(tag),
  );
}

function buildPipelinePayload(parsed: PipelineClientInput) {
  return {
    business_name: parsed.business_name.trim(),
    contact_name: parsed.contact_name.trim(),
    contact_email: parsed.contact_email ?? null,
    phone: parsed.phone ?? null,
    website_url: parsed.website_url ?? null,
    status: parsed.status as PipelineStatus,
    last_conversation: parsed.last_conversation?.trim() || null,
    plan: parsed.plan?.trim() || null,
    estimated_monthly_value_cents:
      parsed.estimated_monthly_value != null
        ? Math.round(parsed.estimated_monthly_value * 100)
        : null,
    health_check_sent: parsed.health_check_sent,
    tags: (parsed.tags ?? []) as PipelineTag[],
    ...(parsed.last_contact_date_explicit
      ? {
          last_contacted_at: parsed.last_contact_date
            ? `${parsed.last_contact_date}T12:00:00.000Z`
            : null,
        }
      : {}),
  };
}

function mapRow(row: Record<string, unknown>): ClientPipelineRecord {
  return {
    id: row.id as string,
    tenant_id: row.tenant_id as string,
    business_name: row.business_name as string,
    contact_name: row.contact_name as string,
    contact_email: (row.contact_email as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    website_url: (row.website_url as string | null) ?? null,
    status: row.status as PipelineStatus,
    last_conversation: (row.last_conversation as string | null) ?? null,
    plan: (row.plan as string | null) ?? null,
    estimated_monthly_value_cents:
      (row.estimated_monthly_value_cents as number | null) ?? null,
    next_follow_up_date: (row.next_follow_up_date as string | null) ?? null,
    last_contacted_at: (row.last_contacted_at as string | null) ?? null,
    health_check_sent: (row.health_check_sent as boolean | null) ?? false,
    tags: normalizeTags(row.tags),
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function touchDemoLastContacted(
  existing: ClientPipelineRecord,
  payload: ReturnType<typeof buildPipelinePayload>,
): string | null {
  const conversationChanged =
    (payload.last_conversation ?? "") !== (existing.last_conversation ?? "");
  if (Object.prototype.hasOwnProperty.call(payload, "last_contacted_at")) {
    return payload.last_contacted_at ?? null;
  }

  if (
    conversationChanged &&
    payload.last_conversation &&
    payload.last_conversation.trim() !== ""
  ) {
    return new Date().toISOString();
  }

  return existing.last_contacted_at;
}

export async function getPipelineClients(): Promise<ClientPipelineRecord[]> {
  await requirePipelineAdmin();

  if (!isSupabaseConfigured()) {
    return demoGetPipelineClients();
  }

  const tenantId = await getSignalWorksTenantId();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(TABLES.clientPipeline)
    .select("*")
    .eq("tenant_id", tenantId)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("getPipelineClients", error.message);
    return [];
  }

  return (data ?? []).map(mapRow);
}

export async function getPipelineClient(
  id: string,
): Promise<ClientPipelineRecord | null> {
  await requirePipelineAdmin();

  if (!isSupabaseConfigured()) {
    return demoGetPipelineClient(id);
  }

  const tenantId = await getSignalWorksTenantId();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(TABLES.clientPipeline)
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) {
    console.error("getPipelineClient", error.message);
    return null;
  }

  if (!data) {
    return null;
  }

  return mapRow(data);
}

export async function createPipelineClient(
  input: PipelineClientInput,
): Promise<PipelineActionResult<ClientPipelineRecord>> {
  try {
    await requirePipelineAdmin();

    const parsed = pipelineClientInputSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }

    const payload = buildPipelinePayload({
      ...parsed.data,
      tags: normalizeTags(parsed.data.tags),
    } as PipelineClientInput);

    if (!isSupabaseConfigured()) {
      const record = demoCreatePipelineClient(payload);
      revalidatePipeline();
      return { ok: true, data: record };
    }

    const tenantId = await getSignalWorksTenantId();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from(TABLES.clientPipeline)
      .insert({
        tenant_id: tenantId,
        ...payload,
      })
      .select("*")
      .single();

    if (error || !data) {
      console.error("createPipelineClient", error?.message);
      return { ok: false, error: PIPELINE_ERRORS.create };
    }

    revalidatePipeline();
    return { ok: true, data: mapRow(data) };
  } catch (err) {
    if (err instanceof Error && err.message.includes("Signal Works internal tenant")) {
      return { ok: false, error: err.message };
    }
    return {
      ok: false,
      error: err instanceof Error && err.message === "Unauthorized"
        ? err.message
        : PIPELINE_ERRORS.create,
    };
  }
}

export async function updatePipelineClient(
  id: string,
  input: PipelineClientInput,
): Promise<PipelineActionResult<ClientPipelineRecord>> {
  try {
    await requirePipelineAdmin();

    const parsed = pipelineClientInputSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }

    const payload = buildPipelinePayload({
      ...parsed.data,
      tags: normalizeTags(parsed.data.tags),
    } as PipelineClientInput);

    if (!isSupabaseConfigured()) {
      const existing = demoGetPipelineClient(id);
      if (!existing) return { ok: false, error: PIPELINE_ERRORS.notFound };
      const record = demoUpdatePipelineClient(id, {
        ...payload,
        last_contacted_at: touchDemoLastContacted(existing, payload),
      });
      if (!record) return { ok: false, error: PIPELINE_ERRORS.notFound };
      revalidatePipeline();
      return { ok: true, data: record };
    }

    const tenantId = await getSignalWorksTenantId();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from(TABLES.clientPipeline)
      .update(payload)
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .select("*")
      .maybeSingle();

    if (error) {
      console.error("updatePipelineClient", error.message);
      return { ok: false, error: PIPELINE_ERRORS.update };
    }

    if (!data) {
      return { ok: false, error: PIPELINE_ERRORS.notFound };
    }

    let updatedData = data;
    if (parsed.data.last_contact_date_explicit) {
      const { data: explicitData, error: explicitError } = await supabase
        .from(TABLES.clientPipeline)
        .update({
          last_contacted_at: payload.last_contacted_at ?? null,
        })
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .select("*")
        .maybeSingle();

      if (explicitError || !explicitData) {
        console.error("updatePipelineClient:lastContact", explicitError?.message);
        return { ok: false, error: PIPELINE_ERRORS.update };
      }
      updatedData = explicitData;
    }

    revalidatePipeline();
    return { ok: true, data: mapRow(updatedData) };
  } catch (err) {
    if (err instanceof Error && err.message.includes("Signal Works internal tenant")) {
      return { ok: false, error: err.message };
    }
    return {
      ok: false,
      error: err instanceof Error && err.message === "Unauthorized"
        ? err.message
        : PIPELINE_ERRORS.update,
    };
  }
}

export async function updatePipelineStatus(
  id: string,
  status: PipelineStatus,
): Promise<PipelineActionResult<ClientPipelineRecord>> {
  try {
    await requirePipelineAdmin();

    const parsed = pipelineStatusUpdateSchema.safeParse({ status });
    if (!parsed.success) {
      return { ok: false, error: "Invalid status" };
    }

    if (!isSupabaseConfigured()) {
      const existing = demoGetPipelineClient(id);
      if (!existing) return { ok: false, error: PIPELINE_ERRORS.notFound };
      const record = demoUpdatePipelineClient(id, {
        status: parsed.data.status as PipelineStatus,
      });
      if (!record) return { ok: false, error: PIPELINE_ERRORS.notFound };
      revalidatePipeline();
      return { ok: true, data: record };
    }

    const tenantId = await getSignalWorksTenantId();
    const supabase = await createClient();
    const { data: existing, error: existingError } = await supabase
      .from(TABLES.clientPipeline)
      .select("last_contacted_at")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (existingError) {
      console.error("updatePipelineStatus:existing", existingError.message);
      return { ok: false, error: PIPELINE_ERRORS.updateStatus };
    }
    if (!existing) {
      return { ok: false, error: PIPELINE_ERRORS.notFound };
    }

    const { data, error } = await supabase
      .from(TABLES.clientPipeline)
      .update({ status: parsed.data.status })
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .select("*")
      .maybeSingle();

    if (error) {
      console.error("updatePipelineStatus", error.message);
      return { ok: false, error: PIPELINE_ERRORS.updateStatus };
    }

    if (!data) {
      return { ok: false, error: PIPELINE_ERRORS.notFound };
    }

    let updatedData = data;
    if (data.last_contacted_at !== existing.last_contacted_at) {
      const { data: restored, error: restoreError } = await supabase
        .from(TABLES.clientPipeline)
        .update({ last_contacted_at: existing.last_contacted_at })
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .select("*")
        .maybeSingle();

      if (restoreError || !restored) {
        console.error(
          "updatePipelineStatus:restoreLastContact",
          restoreError?.message,
        );
        return { ok: false, error: PIPELINE_ERRORS.updateStatus };
      }
      updatedData = restored;
    }

    revalidatePipeline();
    return { ok: true, data: mapRow(updatedData) };
  } catch (err) {
    if (err instanceof Error && err.message.includes("Signal Works internal tenant")) {
      return { ok: false, error: err.message };
    }
    return {
      ok: false,
      error: err instanceof Error && err.message === "Unauthorized"
        ? err.message
        : PIPELINE_ERRORS.updateStatus,
    };
  }
}

export async function updatePipelineLastContact(
  id: string,
  lastContactDate: string | null,
): Promise<PipelineActionResult<ClientPipelineRecord>> {
  try {
    await requirePipelineAdmin();

    const parsed = pipelineLastContactUpdateSchema.safeParse({
      last_contact_date: lastContactDate,
    });
    if (!parsed.success) {
      return { ok: false, error: "Invalid last contact date" };
    }

    const lastContactedAt = parsed.data.last_contact_date
      ? `${parsed.data.last_contact_date}T12:00:00.000Z`
      : null;

    if (!isSupabaseConfigured()) {
      const record = demoUpdatePipelineClient(id, {
        last_contacted_at: lastContactedAt,
      });
      if (!record) return { ok: false, error: PIPELINE_ERRORS.notFound };
      revalidatePipeline();
      return { ok: true, data: record };
    }

    const tenantId = await getSignalWorksTenantId();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from(TABLES.clientPipeline)
      .update({ last_contacted_at: lastContactedAt })
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .select("*")
      .maybeSingle();

    if (error) {
      console.error("updatePipelineLastContact", error.message);
      return { ok: false, error: PIPELINE_ERRORS.updateLastContact };
    }
    if (!data) {
      return { ok: false, error: PIPELINE_ERRORS.notFound };
    }

    revalidatePipeline();
    return { ok: true, data: mapRow(data) };
  } catch (err) {
    if (
      err instanceof Error &&
      err.message.includes("Signal Works internal tenant")
    ) {
      return { ok: false, error: err.message };
    }
    return {
      ok: false,
      error:
        err instanceof Error && err.message === "Unauthorized"
          ? err.message
          : PIPELINE_ERRORS.updateLastContact,
    };
  }
}

export async function deletePipelineClient(
  id: string,
): Promise<PipelineActionResult> {
  try {
    await requirePipelineAdmin();

    if (!isSupabaseConfigured()) {
      const deleted = demoDeletePipelineClient(id);
      if (!deleted) return { ok: false, error: PIPELINE_ERRORS.notFound };
      revalidatePipeline();
      return { ok: true, data: undefined };
    }

    const tenantId = await getSignalWorksTenantId();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from(TABLES.clientPipeline)
      .delete()
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("deletePipelineClient", error.message);
      return { ok: false, error: PIPELINE_ERRORS.delete };
    }

    if (!data) {
      return { ok: false, error: PIPELINE_ERRORS.notFound };
    }

    revalidatePipeline();
    return { ok: true, data: undefined };
  } catch (err) {
    if (err instanceof Error && err.message.includes("Signal Works internal tenant")) {
      return { ok: false, error: err.message };
    }
    return {
      ok: false,
      error: err instanceof Error && err.message === "Unauthorized"
        ? err.message
        : PIPELINE_ERRORS.delete,
    };
  }
}

export async function bulkDeletePipelineClients(
  ids: string[],
): Promise<PipelineActionResult<string[]>> {
  try {
    await requirePipelineAdmin();

    const parsed = z
      .array(z.string().min(1))
      .min(1)
      .max(500)
      .safeParse([...new Set(ids)]);
    if (!parsed.success) {
      return { ok: false, error: "Select at least one valid client" };
    }

    if (!isSupabaseConfigured()) {
      const deletedIds = demoBulkDeletePipelineClients(parsed.data);
      revalidatePipeline();
      return { ok: true, data: deletedIds };
    }

    const tenantId = await getSignalWorksTenantId();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from(TABLES.clientPipeline)
      .delete()
      .eq("tenant_id", tenantId)
      .in("id", parsed.data)
      .select("id");

    if (error) {
      console.error("bulkDeletePipelineClients", error.message);
      return { ok: false, error: PIPELINE_ERRORS.bulkDelete };
    }

    const deletedIds = (data ?? []).map((row) => row.id as string);
    if (deletedIds.length === 0) {
      return { ok: false, error: PIPELINE_ERRORS.notFound };
    }

    revalidatePipeline();
    return { ok: true, data: deletedIds };
  } catch (err) {
    if (
      err instanceof Error &&
      err.message.includes("Signal Works internal tenant")
    ) {
      return { ok: false, error: err.message };
    }
    return {
      ok: false,
      error:
        err instanceof Error && err.message === "Unauthorized"
          ? err.message
          : PIPELINE_ERRORS.bulkDelete,
    };
  }
}
