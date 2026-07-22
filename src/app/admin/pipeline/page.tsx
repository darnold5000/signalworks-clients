import { PipelinePageClient } from "@/components/admin/pipeline/pipeline-page-client";
import { getPipelineClients } from "@/lib/pipeline/clients";

export default async function AdminPipelinePage() {
  const clients = await getPipelineClients();

  return <PipelinePageClient initialClients={clients} />;
}
