import { CLIENT_DOCUMENTS_BUCKET } from "@/lib/documents/constants";

/** Stored in `documents.file_url` for uploads (not a public HTTP URL). */
export function buildClientDocumentStoragePath(args: {
  tenantId: string;
  documentId: string;
  fileName: string;
}): string {
  const safeName = sanitizeFileName(args.fileName);
  return `${args.tenantId}/${args.documentId}/${safeName}`;
}

export function sanitizeFileName(fileName: string): string {
  const base = fileName.trim().split(/[/\\]/).pop() ?? "file";
  const cleaned = base.replace(/[^\w.\- ()]/g, "_").replace(/_+/g, "_");
  return cleaned.length > 0 ? cleaned.slice(0, 180) : "file";
}

export function isStorageBackedDocumentFileUrl(fileUrl: string): boolean {
  return !/^https?:\/\//i.test(fileUrl.trim());
}

export function portalDocumentDownloadPath(documentId: string): string {
  return `/api/portal/documents/file/${documentId}`;
}

export function storageBucketAndPath(
  storagePath: string,
): { bucket: string; path: string } {
  return { bucket: CLIENT_DOCUMENTS_BUCKET, path: storagePath };
}
