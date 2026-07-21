import { notFound } from "next/navigation";
import { TechnicalProfileView } from "@/components/admin/technical-profile-view";
import { getAdminClientBundle } from "@/lib/admin/client-records";

export default async function AdminClientTechnicalPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const bundle = await getAdminClientBundle(tenantId);
  if (!bundle) notFound();

  return <TechnicalProfileView bundle={bundle} />;
}
