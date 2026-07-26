import { NextResponse } from "next/server";
import {
  createSignedDocumentUrl,
  getTenantDocument,
} from "@/lib/documents/service";
import {
  isStorageBackedDocumentFileUrl,
} from "@/lib/documents/paths";
import { getCurrentProfile } from "@/lib/auth";
import { getPrimaryClient } from "@/lib/data";
import { isServiceRoleConfigured } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await getPrimaryClient();
  if (!client) {
    return NextResponse.json({ error: "No client access" }, { status: 403 });
  }

  if (!isServiceRoleConfigured()) {
    return NextResponse.json(
      { error: "Downloads are not configured." },
      { status: 503 },
    );
  }

  const { documentId } = await params;
  const document = await getTenantDocument({
    tenantId: client.id,
    documentId,
  });

  if (!document) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  if (!isStorageBackedDocumentFileUrl(document.file_url)) {
    return NextResponse.redirect(document.file_url);
  }

  try {
    const signedUrl = await createSignedDocumentUrl(document.file_url);
    return NextResponse.redirect(signedUrl);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not open document.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
