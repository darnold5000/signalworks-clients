import { NextResponse } from "next/server";
import { wrapSowForPrintDocument } from "@/lib/legal/sow-print";
import { getCurrentProfile } from "@/lib/auth";
import { getPrimaryClient } from "@/lib/data";
import {
  getLegalDocument,
  resolveTenantSowDocumentId,
} from "@/lib/offers/queries";

export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await getPrimaryClient();
  if (!client) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const download = new URL(request.url).searchParams.get("download") === "1";
  const sowDocumentId = await resolveTenantSowDocumentId(client.id);
  if (!sowDocumentId) {
    return NextResponse.json({ error: "SOW not found" }, { status: 404 });
  }

  const sow = await getLegalDocument(sowDocumentId);
  if (!sow) {
    return NextResponse.json({ error: "SOW not found" }, { status: 404 });
  }

  if (download) {
    const html = wrapSowForPrintDocument(
      sow.content_html,
      "Signal Works — Statement of Work",
    );
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="signal-works-statement-of-work.html"',
      },
    });
  }

  return NextResponse.json({ html: sow.content_html, title: sow.title });
}
