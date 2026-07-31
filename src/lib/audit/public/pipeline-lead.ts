import { createServiceClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/supabase/tables";

export async function createPipelineLeadForAudit(input: {
  businessName: string | null;
  contactName: string | null;
  contactEmail: string | null;
  normalizedUrl: string;
  normalizedDomain: string;
  overallScore: number | null;
}): Promise<string | null> {
  try {
    const supabase = createServiceClient();
    const { data: tenant, error: tenantError } = await supabase
      .from(TABLES.tenants)
      .select("id")
      .eq("slug", "signalworks")
      .eq("platform_category", "internal")
      .eq("status", "active")
      .maybeSingle();

    if (tenantError || !tenant?.id) {
      console.error("[audit/pipeline-lead] tenant lookup failed", tenantError?.message);
      return null;
    }

    const scoreLabel =
      input.overallScore != null ? `Score: ${input.overallScore}` : "Score pending";

    const { data, error } = await supabase
      .from(TABLES.clientPipeline)
      .insert({
        tenant_id: tenant.id,
        business_name: input.businessName ?? input.normalizedDomain,
        contact_name: input.contactName?.trim() || "Website health check lead",
        contact_email: input.contactEmail?.trim() || null,
        website_url: input.normalizedUrl,
        status: "potential",
        last_conversation: `Free Website Health Check submitted on hiresignalworks.com (${scoreLabel}).`,
        tags: ["Other"],
      })
      .select("id")
      .single();

    if (error || !data?.id) {
      console.error("[audit/pipeline-lead] insert failed", error?.message);
      return null;
    }

    return data.id;
  } catch (error) {
    console.error("[audit/pipeline-lead] unexpected error", error);
    return null;
  }
}

export async function linkAuditRequestToPipeline(
  requestId: string,
  pipelineLeadId: string,
): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from(TABLES.auditRequests)
    .update({ pipeline_lead_id: pipelineLeadId })
    .eq("id", requestId);

  if (error) {
    console.error("[audit/pipeline-lead] link failed", error.message);
  }
}
