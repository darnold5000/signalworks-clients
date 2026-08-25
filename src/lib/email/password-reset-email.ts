import { siteConfig } from "@/lib/site";
import { inviteFromAddress, isResendConfigured } from "@/lib/email/client-invite-email";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function sendPasswordResetEmail(args: {
  email: string;
  resetLink: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!isResendConfigured()) {
    return { ok: false, error: "Resend is not configured." };
  }

  const resendKey = process.env.RESEND_API_KEY?.trim();
  const from = inviteFromAddress();
  if (!resendKey || !from) {
    return { ok: false, error: "Resend is not configured." };
  }

  const emailNorm = args.email.trim().toLowerCase();
  const portalName = `${siteConfig.name} ${siteConfig.productName}`;
  const subject = `Reset your ${portalName} password`;
  const cta = "Reset your password";
  const htmlBody = [
    `<p>You requested a password reset for your ${escapeHtml(portalName)}.</p>`,
    `<p><a href="${escapeHtml(args.resetLink)}">${escapeHtml(cta)}</a></p>`,
    `<p>If you did not request this, you can ignore this email.</p>`,
    `<p>This link works once and expires after a short time. If it has expired, request a new reset from <a href="https://clients.hiresignalworks.com/login">clients.hiresignalworks.com/login</a>.</p>`,
  ].join("");
  const textBody = [
    `You requested a password reset for your ${portalName}.`,
    "",
    `${cta}: ${args.resetLink}`,
    "",
    "If you did not request this, you can ignore this email.",
    "",
    "Request a new reset at https://clients.hiresignalworks.com/login if this link has expired.",
  ].join("\n");

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
      subject,
      click_tracking: false,
      open_tracking: false,
      html: htmlBody,
      text: textBody,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[password-reset-email] Resend failed", res.status, body);
    return { ok: false, error: "Could not send password reset email." };
  }

  return { ok: true };
}
