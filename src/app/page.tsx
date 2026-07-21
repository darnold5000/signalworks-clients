import { redirect } from "next/navigation";
import { getCurrentProfile, isPlatformAdmin } from "@/lib/auth";
import { getPrimaryClient } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export default async function HomePage() {
  const profile = await getCurrentProfile();

  if (!isSupabaseConfigured()) {
    redirect(profile?.role === "admin" ? "/admin" : "/overview");
  }

  if (!profile) redirect("/login");

  if (await isPlatformAdmin()) redirect("/admin");

  const client = await getPrimaryClient();
  if (!client) redirect("/no-access");

  redirect("/overview");
}
