import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { supabaseServerAuthOptions } from "@/lib/supabase/auth-options";

type PendingCookie = {
  name: string;
  value: string;
  options?: Parameters<Awaited<ReturnType<typeof cookies>>["set"]>[2];
};

export async function POST() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    return NextResponse.json({ ok: true });
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

  await supabase.auth.signOut();

  const response = NextResponse.json({ ok: true });
  for (const c of pendingCookies) {
    response.cookies.set(c.name, c.value, {
      ...c.options,
      path: c.options?.path ?? "/",
      sameSite: c.options?.sameSite ?? "lax",
    });
  }
  response.cookies.set("sw_demo_mode", "", { path: "/", maxAge: 0 });

  return response;
}
