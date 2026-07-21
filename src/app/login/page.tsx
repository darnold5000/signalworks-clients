import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";
import { userNeedsPasswordSetup } from "@/lib/auth/password-setup";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export default async function LoginPage() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user && userNeedsPasswordSetup(user)) {
      redirect("/auth/set-password");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,_#ffffff_0%,_#f7f6f3_55%,_#efece6_100%)] px-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
