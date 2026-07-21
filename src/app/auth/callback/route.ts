import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseServerAuthOptions } from "@/lib/supabase/auth-options";

function safeNextPath(nextRaw: string | null): string {
  if (nextRaw && nextRaw.startsWith("/") && !nextRaw.startsWith("//")) {
    return nextRaw;
  }
  return "/auth/set-password";
}

/**
 * Exchanges PKCE `code` or `token_hash` from invite / recovery emails, sets
 * session cookies, then redirects to the next path (usually accept-invite).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = safeNextPath(searchParams.get("next"));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (url && anonKey && (code || tokenHash)) {
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
            response.cookies.set(name, value, options);
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
    } else if (tokenHash && type) {
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
  }

  const fallback = new URL("/auth/set-password", origin);
  fallback.searchParams.set("error", "invite_link");
  return NextResponse.redirect(fallback);
}
