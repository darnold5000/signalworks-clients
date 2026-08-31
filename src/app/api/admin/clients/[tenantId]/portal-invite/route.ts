import { NextResponse } from "next/server";
import { z } from "zod";
import { createClientPortalAccessLink, deliverClientInviteLink } from "@/lib/admin/client-invite-link";
import { getCurrentProfile, isPlatformAdmin } from "@/lib/auth";
import { ROLE_SLUGS } from "@/lib/permissions";
import { createServiceClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/supabase/tables";

const schema = z.object({ contactId: z.string().uuid() });

export async function POST(request: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  const actor = await getCurrentProfile();
  if (!actor || !(await isPlatformAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Select a valid contact." }, { status: 400 });
  const { tenantId } = await params;
  const supabase = createServiceClient();
  const [{ data: contact }, { data: tenant }] = await Promise.all([
    supabase.from(TABLES.tenantContacts).select("id, name, email").eq("id", parsed.data.contactId).eq("tenant_id", tenantId).maybeSingle(),
    supabase.from(TABLES.tenants).select("display_name").eq("id", tenantId).maybeSingle(),
  ]);
  if (!contact?.email || !tenant) return NextResponse.json({ error: "Contact not found or has no email." }, { status: 404 });
  const link = await createClientPortalAccessLink(supabase, { email: contact.email, fullName: contact.name, tenantId });
  if ("error" in link) return NextResponse.json({ error: link.error }, { status: 400 });
  const { data: role } = await supabase.from(TABLES.roles).select("id").is("tenant_id", null).eq("slug", ROLE_SLUGS.tenantOwner).single();
  if (!role) return NextResponse.json({ error: "Tenant owner role is not configured." }, { status: 500 });
  await supabase.from(TABLES.profiles).upsert({ id: link.userId, email: contact.email.toLowerCase(), full_name: contact.name, active: true }, { onConflict: "id" });
  const { error: membershipError } = await supabase.from(TABLES.tenantMemberships).upsert({ tenant_id: tenantId, user_id: link.userId, role_id: role.id, status: "active" }, { onConflict: "tenant_id,user_id" });
  if (membershipError) return NextResponse.json({ error: membershipError.message }, { status: 400 });
  await supabase.from(TABLES.tenantProfiles).update({ onboarding_status: "invited", internal_status: "invited" }).eq("tenant_id", tenantId);
  const delivery = await deliverClientInviteLink({ email: contact.email, fullName: contact.name, businessName: tenant.display_name, inviteLink: link.inviteLink, linkType: link.linkType });
  return NextResponse.json({
    email: contact.email,
    inviteLink: delivery.inviteMethod === "link" ? link.inviteLink : null,
    message: delivery.inviteMethod === "email" ? `Portal access email sent to ${contact.email}.` : delivery.inviteEmailError ? `${delivery.inviteEmailError} Copy the private invite link below.` : `Portal access granted. Copy the private invite link below.`,
  });
}
