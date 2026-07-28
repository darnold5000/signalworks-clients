import { NextResponse } from "next/server";
import { z } from "zod";
import { deletePortalClientTenant } from "@/lib/admin/delete-client-service";
import { getCurrentProfile, isPlatformAdmin } from "@/lib/auth";

const deleteBodySchema = z.object({
  confirmSlug: z.string().min(1),
});

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const profile = await getCurrentProfile();
  if (!profile || !(await isPlatformAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tenantId } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = deleteBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = await deletePortalClientTenant({
    tenantId,
    confirmSlug: parsed.data.confirmSlug,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    message: `${result.displayName} was removed from the client portal. Their Signal Works login was not deleted.`,
  });
}
