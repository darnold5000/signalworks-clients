import { NextResponse } from "next/server";
import { inviteClientRequestSchema } from "@/lib/catalog/invite-validation";
import { getCurrentProfile, isPlatformAdmin } from "@/lib/auth";
import { inviteClientWithOffer } from "@/lib/admin/invite-client-service";
import {
  isServiceRoleConfigured,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

function validationErrorMessage(error: import("zod").ZodError): string {
  const fieldErrors = error.flatten().fieldErrors;
  const parts = Object.entries(fieldErrors).flatMap(([field, messages]) => {
    if (!Array.isArray(messages)) return [];
    return messages.map((message) => `${field}: ${message}`);
  });
  return parts[0] ?? "Invalid request";
}

export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || !(await isPlatformAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is required to invite clients." },
      { status: 503 },
    );
  }

  if (!isServiceRoleConfigured()) {
    return NextResponse.json(
      {
        error:
          "Server configuration is incomplete. Contact your administrator.",
      },
      { status: 503 },
    );
  }

  const parsed = inviteClientRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: validationErrorMessage(parsed.error),
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const result = await inviteClientWithOffer(parsed.data, profile.id);

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
        tenantId: result.tenantId,
        note: result.note,
      },
      { status: result.tenantId ? 400 : 400 },
    );
  }

  return NextResponse.json({
    tenantId: result.tenantId,
    clientId: result.clientId,
    offerId: result.offerId,
    email: result.email,
    plan: result.planName,
    inviteMethod: result.inviteMethod,
    inviteLink: result.inviteLink,
    message: result.message,
    redirectTo: result.redirectTo,
  });
}
