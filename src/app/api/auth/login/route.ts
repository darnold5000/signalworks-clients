import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authDebug } from "@/lib/auth-debug";
import { PERMISSIONS } from "@/lib/permissions";
import { supabaseServerAuthOptions } from "@/lib/supabase/auth-options";
import { createServiceClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/supabase/tables";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

type PendingCookie = {
  name: string;
  value: string;
  options?: Parameters<Awaited<ReturnType<typeof cookies>>["set"]>[2];
};

function applyCookies(response: NextResponse, pending: PendingCookie[]) {
  for (const c of pending) {
    response.cookies.set(c.name, c.value, {
      ...c.options,
      path: c.options?.path ?? "/",
      sameSite: c.options?.sameSite ?? "lax",
    });
  }
}

async function ensureProfile(userId: string, email: string, fullName: string | null) {
  const service = createServiceClient();
  await service.from(TABLES.profiles).upsert(
    {
      id: userId,
      email,
      full_name: fullName,
      active: true,
    },
    { onConflict: "id" },
  );
}

async function resolveRedirectTo(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
): Promise<string> {
  const { data: isAdmin, error: adminError } = await supabase.rpc(
    "has_platform_permission",
    { permission_name: PERMISSIONS.manageTenants },
  );

  authDebug("login-route", {
    userId,
    manageTenants: Boolean(isAdmin),
    adminRpcError: adminError?.message ?? null,
  });

  if (isAdmin) return "/admin";

  const { data: memberships } = await supabase
    .from(TABLES.tenantMemberships)
    .select("tenant_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1);

  if ((memberships ?? []).length > 0) return "/overview";
  return "/no-access";
}

/**
 * Server-side password login so Supabase auth cookies are set on the response.
 * Browser-only signInWithPassword often fails to share cookies with Next.js RSC.
 */
export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    return NextResponse.json(
      { error: "Supabase is not configured." },
      { status: 503 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 400 });
  }

  const cookieStore = await cookies();
  const pendingCookies: PendingCookie[] = [];

  const supabase = createServerClient(url, anonKey, {
    ...supabaseServerAuthOptions,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          pendingCookies.push({ name, value, options });
        });
      },
    },
  });

  // Clear stale or half-finished invite sessions before password login.
  await supabase.auth.signOut().catch(() => undefined);

  const { data: signIn, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !signIn.user) {
    authDebug("login-route", {
      loginResultUserId: null,
      error: error?.message ?? "no user",
    });
    return NextResponse.json(
      { error: error?.message ?? "Invalid email or password." },
      { status: 401 },
    );
  }

  const user = signIn.user;
  authDebug("login-route", {
    loginResultUserId: user.id,
    cookieNames: pendingCookies.map((c) => c.name),
  });

  try {
    await ensureProfile(
      user.id,
      user.email ?? parsed.data.email,
      typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : null,
    );
  } catch (profileError) {
    authDebug("login-route", {
      userId: user.id,
      profileError:
        profileError instanceof Error ? profileError.message : "unknown",
    });
  }

  const redirectTo = await resolveRedirectTo(supabase, user.id);

  const response = NextResponse.json({
    ok: true,
    userId: user.id,
    redirectTo,
  });
  applyCookies(response, pendingCookies);
  response.cookies.set("sw_demo_mode", "", { path: "/", maxAge: 0 });

  return response;
}
