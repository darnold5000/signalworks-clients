import { redirect } from "next/navigation";

export default async function AdminClientIndexPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  redirect(`/admin/clients/${tenantId}/overview`);
}
