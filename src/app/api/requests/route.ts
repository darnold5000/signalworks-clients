import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/auth";
import { DEMO_REQUESTS } from "@/lib/demo-data";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { TABLES } from "@/lib/supabase/tables";
import type { RequestType, ServiceRequest } from "@/lib/types";

const bodySchema = z.object({
  tenantId: z.string().uuid(),
  requestType: z.enum([
    "text_change",
    "new_photo",
    "hours_update",
    "new_service",
    "scheduling_update",
    "new_page_or_feature",
    "other",
  ]),
  title: z.string().min(3).max(120),
  description: z.string().min(5).max(4000),
});

export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json();
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { tenantId, requestType, title, description } = parsed.data;

  if (!isSupabaseConfigured()) {
    const demo: ServiceRequest = {
      id: `demo-${Date.now()}`,
      tenant_id: tenantId,
      created_by: profile.id,
      request_type: requestType as RequestType,
      title,
      description,
      status: "submitted",
      admin_notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: null,
    };
    DEMO_REQUESTS.unshift(demo);
    return NextResponse.json({ request: demo });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from(TABLES.serviceRequests)
    .insert({
      tenant_id: tenantId,
      created_by: profile.id,
      request_type: requestType,
      title,
      description,
      status: "submitted",
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ request: data });
}
