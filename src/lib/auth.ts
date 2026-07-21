import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { authDebug } from "@/lib/auth-debug";
import {
  DEMO_ADMIN,
  DEMO_CLIENT_USER,
} from "@/lib/demo-data";
import { PERMISSIONS, userHasPlatformPermission } from "@/lib/permissions";
import {
  createClient,
  createServiceClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import { TABLES } from "@/lib/supabase/tables";
import type { Profile } from "@/lib/types";

export type DemoMode = "client" | "admin";

export async function getDemoMode(): Promise<DemoMode> {
  const store = await cookies();
  const mode = store.get("sw_demo_mode")?.value;
  return mode === "admin" ? "admin" : "client";
}

export async function isPlatformAdmin(): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return (await getDemoMode()) === "admin";
  }

  const allowed = await userHasPlatformPermission(PERMISSIONS.manageTenants);
  authDebug("isPlatformAdmin", { manageTenants: allowed });
  return allowed;
}

async function ensureProfileForUser(user: User): Promise<Profile | null> {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from(TABLES.profiles)
    .select("*")
    .eq("id", user.id)
    .eq("active", true)
    .maybeSingle();

  if (existing) {
    return existing as Profile;
  }

  // Auth user without a profiles row (manual Dashboard user, pre-trigger signup, etc.)
  const service = createServiceClient();
  const { data: created, error } = await service
    .from(TABLES.profiles)
    .upsert(
      {
        id: user.id,
        email: user.email ?? "",
        full_name:
          (typeof user.user_metadata?.full_name === "string"
            ? user.user_metadata.full_name
            : null) ?? null,
        active: true,
      },
      { onConflict: "id" },
    )
    .select("*")
    .single();

  if (error) {
    authDebug("ensureProfileForUser", {
      userId: user.id,
      error: error.message,
    });
    return null;
  }

  authDebug("ensureProfileForUser", {
    userId: user.id,
    created: true,
  });

  return (created as Profile) ?? null;
}

export async function getCurrentProfile(): Promise<Profile | null> {
  if (!isSupabaseConfigured()) {
    const mode = await getDemoMode();
    return mode === "admin" ? DEMO_ADMIN : DEMO_CLIENT_USER;
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  authDebug("getCurrentProfile", {
    dashboardServerUserId: user?.id ?? null,
    userError: userError?.message ?? null,
  });

  if (!user) return null;

  const profile = await ensureProfileForUser(user);
  if (profile) return profile;

  authDebug("getCurrentProfile", {
    dashboardServerUserId: user.id,
    profileFallback: true,
  });

  return {
    id: user.id,
    email: user.email ?? "",
    full_name:
      typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : null,
    active: true,
    created_at: user.created_at,
    updated_at: user.updated_at ?? user.created_at,
  };
}

export async function requireUser(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  return profile;
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await requireUser();
  if (!(await isPlatformAdmin())) redirect("/");
  return profile;
}
