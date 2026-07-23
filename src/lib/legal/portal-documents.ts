import { createClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/supabase/tables";
import type { LegalDocument } from "@/lib/database/phase1-types";

export type PortalDocumentKind = "file" | "legal" | "acceptance";

export type PortalDocumentItem = {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  kind: PortalDocumentKind;
  href: string;
  downloadHref?: string;
};

export async function getPortalDocumentsForClient(
  tenantId: string,
): Promise<PortalDocumentItem[]> {
  const supabase = await createClient();

  const [{ data: files }, { data: legalDocs }, { data: acceptances }] =
    await Promise.all([
      supabase
        .from(TABLES.documents)
        .select("id, title, description, file_url, created_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false }),
      supabase
        .from(TABLES.legalDocuments)
        .select("id, title, document_type, effective_date, created_at")
        .eq("tenant_id", tenantId)
        .eq("active", true)
        .order("created_at", { ascending: false }),
      supabase
        .from(TABLES.agreementAcceptances)
        .select(
          "id, accepted_at, accepted_name, legal_document:legal_documents(title, document_type)",
        )
        .eq("tenant_id", tenantId)
        .order("accepted_at", { ascending: false }),
    ]);

  const items: PortalDocumentItem[] = [];

  for (const doc of legalDocs ?? []) {
    const legal = doc as Pick<
      LegalDocument,
      "id" | "title" | "document_type" | "created_at"
    >;
    const href =
      legal.document_type === "statement_of_work"
        ? "/legal/sow"
        : legal.document_type === "terms_of_service"
          ? "/legal/terms"
          : `/documents/legal/${legal.id}`;
    const downloadHref =
      legal.document_type === "statement_of_work"
        ? "/api/portal/legal/sow?download=1"
        : legal.document_type === "terms_of_service"
          ? "/api/portal/legal/terms?download=1"
          : undefined;
    items.push({
      id: legal.id,
      title: legal.title,
      description:
        legal.document_type === "statement_of_work"
          ? "Statement of Work for your proposal"
          : "Legal document",
      created_at: legal.created_at,
      kind: "legal",
      href,
      downloadHref,
    });
  }

  for (const row of acceptances ?? []) {
    const acceptance = row as {
      id: string;
      accepted_at: string;
      accepted_name: string;
      legal_document:
        | { title: string; document_type: string }
        | { title: string; document_type: string }[]
        | null;
    };
    const legalDoc = Array.isArray(acceptance.legal_document)
      ? acceptance.legal_document[0]
      : acceptance.legal_document;
    const docTitle =
      legalDoc?.title ??
      (legalDoc?.document_type === "terms_of_service"
        ? "Terms of Service"
        : "Agreement");
    items.push({
      id: acceptance.id,
      title: `${docTitle} (signed)`,
      description: `Accepted by ${acceptance.accepted_name}`,
      created_at: acceptance.accepted_at,
      kind: "acceptance",
      href: `/documents/accepted/${acceptance.id}`,
      downloadHref: `/api/portal/documents/accepted/${acceptance.id}?download=1`,
    });
  }

  for (const doc of files ?? []) {
    items.push({
      id: doc.id as string,
      title: doc.title as string,
      description: (doc.description as string | null) ?? "Uploaded file",
      created_at: doc.created_at as string,
      kind: "file",
      href: doc.file_url as string,
    });
  }

  return items.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}
