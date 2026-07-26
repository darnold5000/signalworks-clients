import Link from "next/link";
import { Download, ExternalLink, FileText } from "lucide-react";
import { PageHeader, Panel } from "@/components/ui";
import { getPrimaryClient } from "@/lib/data";
import { getPortalDocumentsForClient } from "@/lib/legal/portal-documents";
import { formatDate } from "@/lib/utils";
import { notFound } from "next/navigation";

export default async function DocumentsPage() {
  const client = await getPrimaryClient();
  if (!client) notFound();
  const docs = await getPortalDocumentsForClient(client.id);

  return (
    <>
      <PageHeader
        title="Documents"
        description="Agreements, proposals, and other important files for your account."
      />
      <Panel>
        {docs.length === 0 ? (
          <p className="text-sm text-muted">
            No documents yet. Your Statement of Work and signed agreements will
            appear here after your proposal is published.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {docs.map((doc) => (
              <li
                key={`${doc.kind}-${doc.id}`}
                className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
              >
                <div className="flex items-start gap-3">
                  <FileText className="mt-0.5 size-4 text-muted" />
                  <div>
                    <p className="font-medium">{doc.title}</p>
                    <p className="mt-1 text-xs text-muted">
                      {doc.description ?? "Document"} ·{" "}
                      {formatDate(doc.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {doc.downloadHref ? (
                    <a
                      href={doc.downloadHref}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-muted underline-offset-2 hover:text-foreground hover:underline"
                    >
                      Download
                      <Download className="size-3.5" />
                    </a>
                  ) : null}
                  <a
                    href={doc.href}
                    target={
                      doc.kind === "file" && doc.href.startsWith("http")
                        ? "_blank"
                        : undefined
                    }
                    rel={
                      doc.kind === "file" && doc.href.startsWith("http")
                        ? "noreferrer"
                        : undefined
                    }
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline-offset-2 hover:underline"
                  >
                    {doc.kind === "file" ? "Open" : "View"}
                    <ExternalLink className="size-3.5" />
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-6 text-sm text-muted">
          Agreements and proposals are listed above. Use{" "}
          <Link href="/billing" className="underline underline-offset-2">
            Billing
          </Link>{" "}
          for payment setup and billing history.
        </p>
      </Panel>
    </>
  );
}
