import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { TABLES } from "@/lib/supabase/tables";

const bodySchema = z.object({
  password: z.string().min(8).max(128),
  fullName: z.string().trim().min(1).max(120),
});

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Authentication is not configured" },
      { status: 503 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      { error: "Invitation session expired. Ask Signal Works to resend your invite." },
      { status: 401 },
    );
  }

  const { error: passwordError } = await supabase.auth.updateUser({
    password: parsed.data.password,
    data: {
      full_name: parsed.data.fullName,
    },
  });

  if (passwordError) {
    return NextResponse.json({ error: passwordError.message }, { status: 400 });
  }

  const { error: profileError } = await supabase.from(TABLES.profiles).upsert(
    {
      id: user.id,
      email: user.email ?? "",
      full_name: parsed.data.fullName,
      active: true,
    },
    { onConflict: "id" },
  );

  if (profileError) {
    console.error("[api/auth/accept-invite] profile", profileError.message);
  }

  return NextResponse.json({ ok: true, redirectTo: "/overview" });
}
