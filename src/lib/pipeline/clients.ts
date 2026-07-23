"use server";

import { revalidatePath } from "next/cache";
import { isPlatformAdmin } from "@/lib/auth";
import {
  demoCreatePipelineClient,
  demoDeletePipelineClient,
  demoGetPipelineClient,
  demoGetPipelineClients,
  demoUpdatePipelineClient,
} from "@/lib/pipeline/demo-store";
import { getSignalWorksTenantId } from "@/lib/pipeline/internal-tenant";
import type {
  ClientPipelineRecord,
  PipelineStatus,
} from "@/lib/pipeline/types";
import {
  pipelineClientInputSchema,
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
  delete: "Could not delete client. Please try again.",
  notFound: "Client not found",
} as const;

async function requirePipelineAdmin(): Promise<void> {
  if (!(await isPlatformAdmin())) {
    throw new Error("Unauthorized");
  }
}

function revalidatePipeline() {
  revalidatePath("/admin/pipeline");
  revalidatePath("/admin/pipeline/[id]", "page");
}

function mapRow(row: Record<string, unknown>): ClientPipelineRecord {
  return {
    id: row.id as string,
    tenant_id: row.tenant_id as string,
    business_name: row.business_name as string,
    contact_name: row.contact_name as string,
    status: row.status as PipelineStatus,
    last_conversation: (row.last_conversation as string | null) ?? null,
    plan: (row.plan as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
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

    const payload = {
      business_name: parsed.data.business_name,
      contact_name: parsed.data.contact_name,
      status: parsed.data.status as PipelineStatus,
      last_conversation: parsed.data.last_conversation?.trim() || null,
      plan: parsed.data.plan?.trim() || null,
    };

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
        business_name: payload.business_name,
        contact_name: payload.contact_name,
        status: payload.status,
        last_conversation: payload.last_conversation,
        plan: payload.plan,
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

    const payload = {
      business_name: parsed.data.business_name,
      contact_name: parsed.data.contact_name,
      status: parsed.data.status as PipelineStatus,
      last_conversation: parsed.data.last_conversation?.trim() || null,
      plan: parsed.data.plan?.trim() || null,
    };

    if (!isSupabaseConfigured()) {
      const record = demoUpdatePipelineClient(id, payload);
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
      const record = demoUpdatePipelineClient(id, {
        status: parsed.data.status as PipelineStatus,
      });
      if (!record) return { ok: false, error: PIPELINE_ERRORS.notFound };
      revalidatePipeline();
      return { ok: true, data: record };
    }

    const tenantId = await getSignalWorksTenantId();
    const supabase = await createClient();
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
        : PIPELINE_ERRORS.updateStatus,
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
