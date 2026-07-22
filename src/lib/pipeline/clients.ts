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

  const supabase = await createClient();
  const { data, error } = await supabase
    .from(TABLES.clientPipeline)
    .select("*")
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

  const supabase = await createClient();
  const { data, error } = await supabase
    .from(TABLES.clientPipeline)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("getPipelineClient", error.message);
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

    const supabase = await createClient();
    const { data, error } = await supabase
      .from(TABLES.clientPipeline)
      .insert(payload)
      .select("*")
      .single();

    if (error || !data) {
      return {
        ok: false,
        error: error?.message ?? "Could not create client",
      };
    }

    revalidatePipeline();
    return { ok: true, data: mapRow(data) };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not create client",
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
      if (!record) return { ok: false, error: "Client not found" };
      revalidatePipeline();
      return { ok: true, data: record };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from(TABLES.clientPipeline)
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();

    if (error || !data) {
      return {
        ok: false,
        error: error?.message ?? "Could not update client",
      };
    }

    revalidatePipeline();
    return { ok: true, data: mapRow(data) };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not update client",
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
      if (!record) return { ok: false, error: "Client not found" };
      revalidatePipeline();
      return { ok: true, data: record };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from(TABLES.clientPipeline)
      .update({ status: parsed.data.status })
      .eq("id", id)
      .select("*")
      .single();

    if (error || !data) {
      return {
        ok: false,
        error: error?.message ?? "Could not update status",
      };
    }

    revalidatePipeline();
    return { ok: true, data: mapRow(data) };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not update status",
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
      if (!deleted) return { ok: false, error: "Client not found" };
      revalidatePipeline();
      return { ok: true, data: undefined };
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from(TABLES.clientPipeline)
      .delete()
      .eq("id", id);

    if (error) {
      return { ok: false, error: error.message };
    }

    revalidatePipeline();
    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not delete client",
    };
  }
}
