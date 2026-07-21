import { redirect } from "next/navigation";
import { getCurrentProfile, isPlatformAdmin } from "@/lib/auth";
import { userNeedsPasswordSetup } from "@/lib/auth/password-setup";
import { getPrimaryClient } from "@/lib/data";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export default async function HomePage() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user && userNeedsPasswordSetup(user)) {
      redirect("/auth/set-password");
    }
  }

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
