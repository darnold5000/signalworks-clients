import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  inviteErrorPath,
  recoveryLinkErrorPath,
} from "@/lib/auth/branded-invite-flow";
import { supabaseServerAuthOptions } from "@/lib/supabase/auth-options";

function safeNextPath(
  nextRaw: string | null,
  type: string | null,
): { path: string; isRecovery: boolean } {
  if (nextRaw?.startsWith("/") && !nextRaw.startsWith("//")) {
    return {
      path: nextRaw,
      isRecovery: nextRaw === "/auth/reset-password",
    };
  }
  if (type === "recovery") {
    return { path: "/auth/reset-password", isRecovery: true };
  }
  if (type === "magiclink" || type === "email") {
    return { path: "/offer", isRecovery: false };
  }
  return { path: "/auth/set-password", isRecovery: false };
}

function failureRedirect(
  origin: string,
  isRecovery: boolean,
): NextResponse {
  const target = isRecovery
    ? new URL(recoveryLinkErrorPath(), origin)
    : new URL("/auth/set-password", origin);
  if (!isRecovery) {
    target.searchParams.set("error", "invite_link");
  }
  return NextResponse.redirect(target);
}

/**
 * Legacy auth callback for PKCE `code` or `token_hash` query params.
 * Password recovery should use /auth/confirm-recovery (token_hash, no PKCE verifier).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const { path: next, isRecovery } = safeNextPath(
    searchParams.get("next"),
    type,
  );

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey || (!code && !tokenHash)) {
    return failureRedirect(origin, isRecovery);
  }

  const redirectUrl = new URL(next, origin);
  const response = NextResponse.redirect(redirectUrl);
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

  if (code) {
    await supabase.auth.signOut();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return response;
    }
    console.error("[auth/callback] exchangeCodeForSession", error.message);
    if (isRecovery || type === "recovery") {
      return failureRedirect(origin, true);
    }
    return NextResponse.redirect(
      new URL(inviteErrorPath("invalid-link"), origin),
    );
  }

  if (tokenHash && type) {
    await supabase.auth.signOut();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as "invite" | "recovery" | "email" | "signup" | "magiclink",
    });
    if (!error) {
      return response;
    }
    console.error("[auth/callback] verifyOtp", error.message);
  }

  return failureRedirect(origin, isRecovery || type === "recovery");
}
