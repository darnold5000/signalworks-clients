import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerAuthOptions } from "@/lib/supabase/auth-options";
import { portalUrlForInvites, recoveryRedirectUrl } from "@/lib/site";

const bodySchema = z.object({
  email: z.string().email(),
});

/** Always returns success so callers cannot probe registered emails. */
export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid email address" },
      { status: 400 },
    );
  }

  if (!url || !anonKey) {
    return NextResponse.json({ ok: true });
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(url, anonKey, {
    ...supabaseServerAuthOptions,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        // No session cookies needed for reset request.
      },
    },
  });

  const email = parsed.data.email.trim().toLowerCase();
  const redirectTo = recoveryRedirectUrl(portalUrlForInvites());

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) {
    console.error("[api/auth/forgot-password]", error.message);
  }

  return NextResponse.json({ ok: true });
}
