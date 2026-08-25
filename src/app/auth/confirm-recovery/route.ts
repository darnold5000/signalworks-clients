import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  mapVerifyOtpFailureToReason,
  recoveryLinkErrorPath,
  resolveRecoveryNextPath,
} from "@/lib/auth/branded-invite-flow";
import { supabaseServerAuthOptions } from "@/lib/supabase/auth-options";

function redirectOnResponse(
  response: NextResponse,
  target: URL,
): NextResponse {
  response.headers.set("Location", target.toString());
  return response;
}

/**
 * Verifies password-recovery token_hash on the server and establishes a session
 * without PKCE code_verifier cookies (works from Mail apps and other devices).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash")?.trim();
  const type = searchParams.get("type")?.trim();
  const next = resolveRecoveryNextPath(searchParams.get("next"));

  if (!tokenHash || type !== "recovery") {
    return NextResponse.redirect(new URL(recoveryLinkErrorPath(), origin));
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    return NextResponse.redirect(new URL(recoveryLinkErrorPath(), origin));
  }

  const successTarget = new URL(next, origin);
  let response = NextResponse.redirect(successTarget);

  const supabase = createServerClient(url, anonKey, {
    ...supabaseServerAuthOptions,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, {
            ...options,
            path: options?.path ?? "/",
            sameSite: options?.sameSite ?? "lax",
          });
        });
      },
    },
  });

  await supabase.auth.signOut();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "recovery",
  });

  if (verifyError) {
    await supabase.auth.signOut();
    console.error(
      "[auth/confirm-recovery] verifyOtp",
      mapVerifyOtpFailureToReason(verifyError.message),
    );
    const failureTarget = new URL(recoveryLinkErrorPath(), origin);
    failureTarget.searchParams.set(
      "reason",
      mapVerifyOtpFailureToReason(verifyError.message),
    );
    return redirectOnResponse(response, failureTarget);
  }

  return response;
}
