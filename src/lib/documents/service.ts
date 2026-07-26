import { randomUUID } from "node:crypto";
import {
  CLIENT_DOCUMENT_ALLOWED_MIME_TYPES,
  CLIENT_DOCUMENT_MAX_BYTES,
  CLIENT_DOCUMENTS_BUCKET,
} from "@/lib/documents/constants";
import { buildClientDocumentStoragePath } from "@/lib/documents/paths";
import { createServiceClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/supabase/tables";
import type { Document } from "@/lib/types";

export async function listTenantDocuments(
  tenantId: string,
): Promise<Document[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from(TABLES.documents)
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data as Document[]) ?? [];
}

export async function getTenantDocument(args: {
  tenantId: string;
  documentId: string;
}): Promise<Document | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from(TABLES.documents)
    .select("*")
    .eq("tenant_id", args.tenantId)
    .eq("id", args.documentId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as Document | null) ?? null;
}

export async function uploadTenantDocument(args: {
  tenantId: string;
  title: string;
  description?: string | null;
  file: File;
}): Promise<Document> {
  if (args.file.size <= 0) {
    throw new Error("Choose a file to upload.");
  }
  if (args.file.size > CLIENT_DOCUMENT_MAX_BYTES) {
    throw new Error("File is too large. Maximum size is 20 MB.");
  }
  const mime = args.file.type || "application/octet-stream";
  if (!CLIENT_DOCUMENT_ALLOWED_MIME_TYPES.has(mime)) {
    throw new Error("This file type is not allowed.");
  }

  const title = args.title.trim();
  if (title.length < 2) {
    throw new Error("Enter a document title (at least 2 characters).");
  }

  const documentId = randomUUID();
  const storagePath = buildClientDocumentStoragePath({
    tenantId: args.tenantId,
    documentId,
    fileName: args.file.name,
  });

  const supabase = createServiceClient();
  const bytes = Buffer.from(await args.file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from(CLIENT_DOCUMENTS_BUCKET)
    .upload(storagePath, bytes, {
      contentType: mime,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data: row, error: insertError } = await supabase
    .from(TABLES.documents)
    .insert({
      id: documentId,
      tenant_id: args.tenantId,
      title,
      description: args.description?.trim() || null,
      file_url: storagePath,
    })
    .select("*")
    .single();

  if (insertError || !row) {
    await supabase.storage.from(CLIENT_DOCUMENTS_BUCKET).remove([storagePath]);
    throw new Error(insertError?.message ?? "Could not save document record.");
  }

  return row as Document;
}

export async function createSignedDocumentUrl(
  storagePath: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.storage
    .from(CLIENT_DOCUMENTS_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "Could not create download link.");
  }

  return data.signedUrl;
}
