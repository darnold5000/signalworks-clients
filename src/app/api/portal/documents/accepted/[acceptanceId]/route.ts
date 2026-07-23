import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { getPrimaryClient } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/supabase/tables";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ acceptanceId: string }> },
) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await getPrimaryClient();
  if (!client) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { acceptanceId } = await params;
  const download = new URL(request.url).searchParams.get("download") === "1";
  const supabase = await createClient();
  const { data: acceptance } = await supabase
    .from(TABLES.agreementAcceptances)
    .select(
      "id, document_snapshot_html, legal_document:legal_documents(title)",
    )
    .eq("id", acceptanceId)
    .eq("tenant_id", client.id)
    .maybeSingle();

  if (!acceptance) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const title =
    (acceptance.legal_document as { title?: string } | null)?.title ??
    "signed-agreement";
  const filename = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.html`;

  if (download) {
    return new NextResponse(acceptance.document_snapshot_html as string, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  return NextResponse.json({
    html: acceptance.document_snapshot_html,
    title,
  });
}
