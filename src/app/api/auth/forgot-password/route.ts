import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { checkForgotPasswordRateLimit } from "@/lib/auth/forgot-password-rate-limit";
import { buildBrandedConfirmRecoveryUrl } from "@/lib/auth/branded-invite-flow";
import { sendPasswordResetEmail } from "@/lib/email/password-reset-email";
import { getClientIp } from "@/lib/rate-limit";
import { portalUrlForInvites, recoveryRedirectUrl } from "@/lib/site";
import { supabaseServerAuthOptions } from "@/lib/supabase/auth-options";
import {
  createServiceClient,
  isServiceRoleConfigured,
} from "@/lib/supabase/server";

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

  const email = parsed.data.email.trim().toLowerCase();

  if (!checkForgotPasswordRateLimit(getClientIp(request), email).ok) {
    return NextResponse.json({ ok: true });
  }

  const portalUrl = portalUrlForInvites();

  if (isServiceRoleConfigured()) {
    try {
      const admin = createServiceClient();
      const recoveryAttempt = await admin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: {
          redirectTo: recoveryRedirectUrl(portalUrl),
        },
      });

      const hashedToken = recoveryAttempt.data?.properties?.hashed_token?.trim();
      if (hashedToken) {
        const resetLink = buildBrandedConfirmRecoveryUrl(portalUrl, hashedToken);
        const sent = await sendPasswordResetEmail({ email, resetLink });
        if (sent.ok) {
          return NextResponse.json({ ok: true });
        }
        console.error(
          "[api/auth/forgot-password] branded recovery email failed",
          sent.error,
        );
      } else if (recoveryAttempt.error) {
        console.error(
          "[api/auth/forgot-password] generateLink recovery",
          recoveryAttempt.error.message,
        );
      }
    } catch (error) {
      console.error(
        "[api/auth/forgot-password] branded recovery path failed",
        error instanceof Error ? error.message : error,
      );
    }
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(url, anonKey, {
    ...supabaseServerAuthOptions,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        // Legacy Supabase email path — no session cookies required here.
      },
    },
  });

  const redirectTo = recoveryRedirectUrl(portalUrl);
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) {
    console.error("[api/auth/forgot-password] resetPasswordForEmail", error.message);
  }

  return NextResponse.json({ ok: true });
}
