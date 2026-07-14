import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  DEMO_ADMIN,
  DEMO_CLIENT_USER,
} from "@/lib/demo-data";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export type DemoMode = "client" | "admin";

export async function getDemoMode(): Promise<DemoMode> {
  const store = await cookies();
  const mode = store.get("sw_demo_mode")?.value;
  return mode === "admin" ? "admin" : "client";
}

export async function getCurrentProfile(): Promise<Profile | null> {
  if (!isSupabaseConfigured()) {
    const mode = await getDemoMode();
    return mode === "admin" ? DEMO_ADMIN : DEMO_CLIENT_USER;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .eq("active", true)
    .single();

  return (data as Profile) ?? null;
}

export async function requireUser(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  return profile;
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await requireUser();
  if (profile.role !== "admin") redirect("/overview");
  return profile;
}
