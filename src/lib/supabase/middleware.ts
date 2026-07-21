import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { authDebug } from "@/lib/auth-debug";

const PROTECTED_PREFIXES = [
  "/overview",
  "/requests",
  "/billing",
  "/documents",
  "/support",
  "/admin",
];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function applySupabaseCookies(
  request: NextRequest,
  cookiesToSet: {
    name: string;
    value: string;
    options?: Parameters<NextResponse["cookies"]["set"]>[2];
  }[],
) {
  cookiesToSet.forEach(({ name, value }) => {
    request.cookies.set(name, value);
  });

  const response = NextResponse.next({ request });

  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, {
      ...options,
      path: options?.path ?? "/",
      sameSite: options?.sameSite ?? "lax",
    });
  });

  return response;
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  let supabaseResponse = NextResponse.next({ request });

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          supabaseResponse = applySupabaseCookies(request, cookiesToSet);
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  authDebug("middleware", {
    pathname,
    middlewareUserId: user?.id ?? null,
    cookieNames: request.cookies.getAll().map((c) => c.name),
  });

  const isPublic =
    pathname === "/login" ||
    pathname === "/no-access" ||
    pathname.startsWith("/api/");

  // Only gate protected app routes. Do not bounce /login <-> / when the app
  // denies access — that caused ERR_TOO_MANY_REDIRECTS.
  if (isProtectedPath(pathname) && !user && !isPublic) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}
