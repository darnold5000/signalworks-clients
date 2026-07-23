import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { getPrimaryClient } from "@/lib/data";
import { getActiveOfferForTenant, getLegalDocument } from "@/lib/offers/queries";

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
  const offer = await getActiveOfferForTenant(client.id);
  if (!offer?.sow_document_id) {
    return NextResponse.json({ error: "SOW not found" }, { status: 404 });
  }

  const sow = await getLegalDocument(offer.sow_document_id);
  if (!sow) {
    return NextResponse.json({ error: "SOW not found" }, { status: 404 });
  }

  if (download) {
    return new NextResponse(sow.content_html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="signal-works-statement-of-work.html"',
      },
    });
  }

  return NextResponse.json({ html: sow.content_html, title: sow.title });
}
