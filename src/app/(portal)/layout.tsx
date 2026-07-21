import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { isPlatformAdmin, requireUser } from "@/lib/auth";
import { getPrimaryClient } from "@/lib/data";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireUser();
  if (await isPlatformAdmin()) redirect("/admin");

  const client = await getPrimaryClient();
  if (!client) redirect("/no-access");

  return (
    <AppShell
      isAdmin={false}
      userEmail={profile.email}
      businessName={client.business_name}
    >
      {children}
    </AppShell>
  );
}
