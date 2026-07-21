import { notFound } from "next/navigation";
import { ContactsList } from "@/components/admin/contacts-list";
import { getAdminClientBundle } from "@/lib/admin/client-records";

export default async function AdminClientContactsPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const bundle = await getAdminClientBundle(tenantId);
  if (!bundle) notFound();

  return <ContactsList contacts={bundle.contacts} />;
}
