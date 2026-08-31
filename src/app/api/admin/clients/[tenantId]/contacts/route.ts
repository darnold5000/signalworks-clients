import { NextResponse } from "next/server";
import { getCurrentProfile, isPlatformAdmin } from "@/lib/auth";
import { contactInputSchema } from "@/lib/admin/contact-validation";
import { createServiceClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/supabase/tables";

export async function POST(request: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile || !(await isPlatformAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = contactInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid contact." }, { status: 400 });
  const { tenantId } = await params;
  const supabase = createServiceClient();
  if (parsed.data.isPrimary) await supabase.from(TABLES.tenantContacts).update({ is_primary: false }).eq("tenant_id", tenantId).eq("is_primary", true);
  const { data, error } = await supabase.from(TABLES.tenantContacts).insert({
    tenant_id: tenantId, name: parsed.data.name, email: parsed.data.email, phone: parsed.data.phone || null, job_title: parsed.data.jobTitle || null,
    contact_type: parsed.data.isPrimary ? "owner" : parsed.data.receivesBilling ? "billing" : "other", is_primary: parsed.data.isPrimary,
    is_billing_contact: parsed.data.receivesBilling, receives_proposals: parsed.data.receivesProposals, receives_billing: parsed.data.receivesBilling, receives_notifications: parsed.data.receivesNotifications,
  }).select("*").single();
  if (error || !data) return NextResponse.json({ error: error?.code === "23505" ? "That email is already a contact for this client." : error?.message ?? "Could not add contact." }, { status: 400 });
  if (parsed.data.isPrimary) await supabase.from(TABLES.tenantProfiles).update({ primary_contact_name: parsed.data.name, primary_contact_email: parsed.data.email, primary_contact_phone: parsed.data.phone || null }).eq("tenant_id", tenantId);
  return NextResponse.json({ contact: data }, { status: 201 });
}
