import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export default async function HomePage() {
  const profile = await getCurrentProfile();

  if (!isSupabaseConfigured()) {
    redirect(profile?.role === "admin" ? "/admin" : "/overview");
  }

  if (!profile) redirect("/login");
  redirect(profile.role === "admin" ? "/admin" : "/overview");
}
