import { notFound } from "next/navigation";
import { AdminClientHeader } from "@/components/admin/admin-client-header";
import { AdminClientNav } from "@/components/admin/admin-client-nav";
import { getAdminClientBundle } from "@/lib/admin/client-records";

export default async function AdminClientLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const bundle = await getAdminClientBundle(tenantId);
  if (!bundle) notFound();

  return (
    <div>
      <AdminClientHeader bundle={bundle} />
      <AdminClientNav tenantId={tenantId} />
      {children}
    </div>
  );
}
