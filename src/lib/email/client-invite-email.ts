import { siteConfig } from "@/lib/site";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function inviteFromAddress(): string | null {
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!from) return null;
  if (from.includes("<")) return from;
  return `${siteConfig.name} <${from}>`;
}

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && inviteFromAddress());
}

export async function sendClientInviteEmail(args: {
  email: string;
  fullName: string;
  businessName: string;
  inviteLink: string;
}): Promise<{ ok: boolean; error?: string }> {
  const resendKey = process.env.RESEND_API_KEY?.trim();
  const from = inviteFromAddress();

  if (!resendKey || !from) {
    return { ok: false, error: "Resend is not configured." };
  }

  const emailNorm = args.email.trim().toLowerCase();
  const firstName = args.fullName.trim().split(/\s+/)[0] || "there";
  const portalName = `${siteConfig.name} ${siteConfig.productName}`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [emailNorm],
      reply_to: siteConfig.supportEmail,
      subject: `You're invited to ${portalName}`,
      html: [
        `<p>Hi ${escapeHtml(firstName)},</p>`,
        `<p>${escapeHtml(siteConfig.name)} has set up your client portal for <strong>${escapeHtml(args.businessName)}</strong>.</p>`,
        `<p>Use the secure link below to set your password and access billing, website requests, and documents.</p>`,
        `<p><a href="${args.inviteLink}">Set up your ${escapeHtml(portalName)} account</a></p>`,
        `<p>If you were not expecting this, you can ignore this email or contact us at <a href="mailto:${siteConfig.supportEmail}">${siteConfig.supportEmail}</a>.</p>`,
      ].join(""),
      text: [
        `Hi ${firstName},`,
        "",
        `${siteConfig.name} has set up your client portal for ${args.businessName}.`,
        "",
        "Use the secure link below to set your password and access billing, website requests, and documents:",
        "",
        args.inviteLink,
        "",
        `Questions? Email ${siteConfig.supportEmail}.`,
      ].join("\n"),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[client-invite-email] Resend failed", res.status, body);
    return { ok: false, error: "Could not send invite email." };
  }

  return { ok: true };
}
