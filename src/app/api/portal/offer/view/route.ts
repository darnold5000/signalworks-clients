import { NextResponse } from "next/server";
import { logTenantActivity } from "@/lib/activity/log-tenant-activity";
import { getActiveOfferForTenant } from "@/lib/offers/queries";
import { getCurrentProfile } from "@/lib/auth";
import { getPrimaryClient } from "@/lib/data";
import { createServiceClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/supabase/tables";

export async function POST() {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await getPrimaryClient();
  if (!client) {
    return NextResponse.json({ error: "No client access" }, { status: 403 });
  }

  const offer = await getActiveOfferForTenant(client.id);
  if (!offer) {
    return NextResponse.json({ error: "No active offer" }, { status: 404 });
  }

  if (offer.status === "published") {
    const supabase = createServiceClient();
    await supabase
      .from(TABLES.clientOffers)
      .update({ status: "viewed" })
      .eq("id", offer.id);

    await supabase
      .from(TABLES.tenantProfiles)
      .update({ onboarding_status: "offer_viewed" })
      .eq("tenant_id", client.id);

    await logTenantActivity({
      tenantId: client.id,
      actorUserId: profile.id,
      actorType: "user",
      action: "offer.viewed",
      entityType: "client_offer",
      entityId: offer.id,
      summary: `Viewed offer "${offer.title}"`,
    });
  }

  return NextResponse.json({ ok: true });
}
