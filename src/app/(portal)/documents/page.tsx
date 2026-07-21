import { PageHeader, Panel } from "@/components/ui";
import { getDocumentsForClient, getPrimaryClient } from "@/lib/data";
import { formatDate } from "@/lib/utils";
import { ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";

export default async function DocumentsPage() {
  const client = await getPrimaryClient();
  if (!client) notFound();
  const docs = await getDocumentsForClient(client.id);

  return (
    <>
      <PageHeader
        title="Documents"
        description="Agreements and other important files for your account."
      />
      <Panel>
        {docs.length === 0 ? (
          <p className="text-sm text-muted">No documents yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {docs.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
                <div>
                  <p className="font-medium">{doc.title}</p>
                  <p className="mt-1 text-xs text-muted">
                    {doc.description ?? "Document"} · {formatDate(doc.created_at)}
                  </p>
                </div>
                <a
                  href={doc.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline-offset-2 hover:underline"
                >
                  Open
                  <ExternalLink className="size-3.5" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
