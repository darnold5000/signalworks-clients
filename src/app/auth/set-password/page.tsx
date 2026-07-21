import type { Metadata } from "next";

import { SetPasswordForm } from "@/components/set-password-form";

export const metadata: Metadata = {
  title: "Create password",
  robots: { index: false, follow: false },
};

export default function SetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,_#ffffff_0%,_#f7f6f3_55%,_#efece6_100%)] px-4">
      <SetPasswordForm />
    </div>
  );
}
