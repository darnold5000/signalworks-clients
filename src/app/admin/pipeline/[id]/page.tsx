import { notFound } from "next/navigation";
import { ClientPipelineDetails } from "@/components/admin/pipeline/client-pipeline-details";
import { getPipelineClient } from "@/lib/pipeline/clients";

export default async function AdminPipelineDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await getPipelineClient(id);

  if (!client) {
    notFound();
  }

  return <ClientPipelineDetails client={client} />;
}
