import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function safeNextPath(nextRaw: string | null): string {
  if (nextRaw && nextRaw.startsWith("/") && !nextRaw.startsWith("//")) {
    return nextRaw;
  }
  return "/auth/accept-invite";
}

/**
 * Exchanges the Auth code (or token_hash) from invite emails, then redirects
 * to /auth/accept-invite to set a password.
 *
 * Invite emails must use redirectTo:
 *   `${APP_URL}/auth/callback?next=/auth/accept-invite`
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
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return response;
      }
      console.error("[auth/callback] exchangeCodeForSession", error.message);
    } else if (tokenHash && type) {
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

  if (url && anonKey) {
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {
          // read-only probe
        },
      },
    });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  const fallback = new URL("/login", origin);
  fallback.searchParams.set("error", "auth_callback");
  return NextResponse.redirect(fallback);
}
