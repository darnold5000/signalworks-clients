import { NextResponse } from "next/server";
import { contactInputSchema } from "@/lib/admin/contact-validation";
import { getCurrentProfile, isPlatformAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/supabase/tables";

async function authorize() {
  const profile = await getCurrentProfile();
  return Boolean(profile && await isPlatformAdmin());
}

export async function PATCH(request: Request, { params }: { params: Promise<{ tenantId: string; contactId: string }> }) {
  if (!(await authorize())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = contactInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid contact." }, { status: 400 });
  const { tenantId, contactId } = await params;
  const supabase = createServiceClient();
  if (parsed.data.isPrimary) await supabase.from(TABLES.tenantContacts).update({ is_primary: false }).eq("tenant_id", tenantId).neq("id", contactId);
  const { data, error } = await supabase.from(TABLES.tenantContacts).update({
    name: parsed.data.name, email: parsed.data.email, phone: parsed.data.phone || null, job_title: parsed.data.jobTitle || null,
    contact_type: parsed.data.isPrimary ? "owner" : parsed.data.receivesBilling ? "billing" : "other", is_primary: parsed.data.isPrimary,
    is_billing_contact: parsed.data.receivesBilling, receives_proposals: parsed.data.receivesProposals, receives_billing: parsed.data.receivesBilling, receives_notifications: parsed.data.receivesNotifications,
  }).eq("id", contactId).eq("tenant_id", tenantId).select("*").maybeSingle();
  if (error || !data) return NextResponse.json({ error: error?.code === "23505" ? "That email is already a contact for this client." : error?.message ?? "Contact not found." }, { status: error ? 400 : 404 });
  if (parsed.data.isPrimary) await supabase.from(TABLES.tenantProfiles).update({ primary_contact_name: parsed.data.name, primary_contact_email: parsed.data.email, primary_contact_phone: parsed.data.phone || null }).eq("tenant_id", tenantId);
  return NextResponse.json({ contact: data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ tenantId: string; contactId: string }> }) {
  if (!(await authorize())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { tenantId, contactId } = await params;
  const supabase = createServiceClient();
  const { data: existing } = await supabase.from(TABLES.tenantContacts).select("is_primary").eq("id", contactId).eq("tenant_id", tenantId).maybeSingle();
  if (!existing) return NextResponse.json({ error: "Contact not found." }, { status: 404 });
  const { error } = await supabase.from(TABLES.tenantContacts).delete().eq("id", contactId).eq("tenant_id", tenantId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (existing.is_primary) {
    const { data: replacement } = await supabase.from(TABLES.tenantContacts).select("id, name, email, phone").eq("tenant_id", tenantId).order("created_at").limit(1).maybeSingle();
    if (replacement) {
      await supabase.from(TABLES.tenantContacts).update({ is_primary: true, contact_type: "owner" }).eq("id", replacement.id);
      await supabase.from(TABLES.tenantProfiles).update({ primary_contact_name: replacement.name, primary_contact_email: replacement.email, primary_contact_phone: replacement.phone }).eq("tenant_id", tenantId);
    } else {
      await supabase.from(TABLES.tenantProfiles).update({ primary_contact_name: null, primary_contact_email: null, primary_contact_phone: null }).eq("tenant_id", tenantId);
    }
  }
  return NextResponse.json({ ok: true });
}
