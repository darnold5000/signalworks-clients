import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { getPrimaryClient } from "@/lib/data";
import {
  formatLegalEffectiveDate,
  renderSignalWorksTosHtml,
} from "@/lib/legal/signal-works-tos";
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
  const termsDocument =
    offer?.terms_document_id
      ? await getLegalDocument(offer.terms_document_id)
      : null;
  const html =
    termsDocument?.content_html ??
    renderSignalWorksTosHtml(formatLegalEffectiveDate());

  if (download) {
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="signal-works-terms-of-service.html"',
      },
    });
  }

  return NextResponse.json({ html });
}
