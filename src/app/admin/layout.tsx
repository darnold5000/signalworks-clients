import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { requireAdmin } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireAdmin();

  return (
    <AppShell isAdmin userEmail={profile.email}>
      {children}
    </AppShell>
  );
}
