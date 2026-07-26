import { NextResponse } from "next/server";
import { logTenantActivity } from "@/lib/activity/log-tenant-activity";
import { uploadTenantDocument } from "@/lib/documents/service";
import { getCurrentProfile, isPlatformAdmin } from "@/lib/auth";
import { isServiceRoleConfigured } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const profile = await getCurrentProfile();
  if (!profile || !(await isPlatformAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isServiceRoleConfigured()) {
    return NextResponse.json(
      { error: "Document upload requires Supabase service role configuration." },
      { status: 503 },
    );
  }

  const { tenantId } = await params;
  const form = await request.formData();
  const title = String(form.get("title") ?? "");
  const description = String(form.get("description") ?? "");
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file." }, { status: 400 });
  }

  try {
    const document = await uploadTenantDocument({
      tenantId,
      title,
      description: description || null,
      file,
    });

    await logTenantActivity({
      tenantId,
      actorUserId: profile.id,
      actorType: "admin",
      action: "document.uploaded",
      entityType: "document",
      entityId: document.id,
      summary: `Uploaded document "${document.title}"`,
    });

    return NextResponse.json({ document });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
