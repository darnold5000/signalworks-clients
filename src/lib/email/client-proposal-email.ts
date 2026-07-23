import type { ClientPortalAccessLinkResult } from "@/lib/admin/client-invite-link";
import { siteConfig } from "@/lib/site";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

type ProposalLinkType = Extract<
  ClientPortalAccessLinkResult,
  { inviteLink: string }
>["linkType"];

export async function sendClientProposalEmail(args: {
  email: string;
  fullName: string;
  businessName: string;
  offerTitle: string;
  portalLink: string;
  linkType: ProposalLinkType;
}): Promise<{ ok: boolean; error?: string }> {
  const resendKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  const fromHeader = from
    ? from.includes("<")
      ? from
      : `${siteConfig.name} <${from}>`
    : null;

  if (!resendKey || !fromHeader) {
    return { ok: false, error: "Resend is not configured." };
  }

  const firstName = args.fullName.trim().split(/\s+/)[0] || "there";
  const portalName = `${siteConfig.name} ${siteConfig.productName}`;
  const ctaLabel =
    args.linkType === "login"
      ? `Sign in to review your proposal`
      : `Review your proposal in ${portalName}`;

  const intro =
    args.linkType === "login"
      ? `${siteConfig.name} has a new proposal ready for <strong>${escapeHtml(args.businessName)}</strong>. Sign in to review services, pricing, and next steps.`
      : `${siteConfig.name} has a new proposal ready for <strong>${escapeHtml(args.businessName)}</strong>. Use the secure link below to review services, pricing, and next steps.`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromHeader,
      to: [args.email.trim().toLowerCase()],
      reply_to: siteConfig.supportEmail,
      subject: `New proposal: ${args.offerTitle}`,
      html: [
        `<p>Hi ${escapeHtml(firstName)},</p>`,
        `<p>${intro}</p>`,
        `<p><strong>${escapeHtml(args.offerTitle)}</strong></p>`,
        `<p><a href="${args.portalLink}">${escapeHtml(ctaLabel)}</a></p>`,
        `<p>If you were not expecting this, contact us at <a href="mailto:${siteConfig.supportEmail}">${siteConfig.supportEmail}</a>.</p>`,
      ].join(""),
      text: [
        `Hi ${firstName},`,
        "",
        `${siteConfig.name} has a new proposal ready for ${args.businessName}.`,
        args.offerTitle,
        "",
        `${ctaLabel}:`,
        args.portalLink,
        "",
        `Questions? Email ${siteConfig.supportEmail}.`,
      ].join("\n"),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[client-proposal-email] Resend failed", res.status, body);
    return { ok: false, error: "Could not send proposal email." };
  }

  return { ok: true };
}
