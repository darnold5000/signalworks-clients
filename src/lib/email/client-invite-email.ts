import { siteConfig } from "@/lib/site";

export type ClientInviteEmailLinkType =
  | "invite"
  | "recovery"
  | "magiclink"
  | "login";

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

function inviteEmailCopy(args: {
  linkType: ClientInviteEmailLinkType;
  firstName: string;
  businessName: string;
  portalName: string;
}): { subject: string; htmlBody: string; textBody: string; cta: string } {
  const business = escapeHtml(args.businessName);
  const portal = escapeHtml(args.portalName);

  if (args.linkType === "magiclink" || args.linkType === "login") {
    const cta =
      args.linkType === "login"
        ? `Sign in to your ${portal}`
        : `Open your ${portal}`;
    const htmlIntro =
      args.linkType === "login"
        ? `${escapeHtml(siteConfig.name)} has set up a client portal for <strong>${business}</strong>. You already have a Signal Works login — use the same email and password you use for our other apps.`
        : `${escapeHtml(siteConfig.name)} has set up a client portal for <strong>${business}</strong>. You already have a Signal Works login — use the secure link below to open your proposal and billing (no new password needed).`;
    const textIntro =
      args.linkType === "login"
        ? `${siteConfig.name} has set up a client portal for ${args.businessName}. Sign in with the same email and password you already use with Signal Works.`
        : `${siteConfig.name} has set up a client portal for ${args.businessName}. Open the link below to access your proposal and billing — no new password needed.`;

    return {
      subject: `Your client portal is ready — ${args.businessName}`,
      cta,
      htmlBody: [
        `<p>Hi ${escapeHtml(args.firstName)},</p>`,
        `<p>${htmlIntro}</p>`,
        `<p><a href="{{LINK}}">${escapeHtml(cta)}</a></p>`,
        `<p>You can also go to <a href="https://clients.hiresignalworks.com/login">clients.hiresignalworks.com/login</a> anytime.</p>`,
      ].join(""),
      textBody: [
        `Hi ${args.firstName},`,
        "",
        textIntro,
        "",
        `${cta}:`,
        "{{LINK}}",
        "",
        "Or sign in at https://clients.hiresignalworks.com/login",
      ].join("\n"),
    };
  }

  if (args.linkType === "recovery") {
    const cta = `Finish setting up your ${portal}`;
    return {
      subject: `Finish your ${args.portalName} setup`,
      cta,
      htmlBody: [
        `<p>Hi ${escapeHtml(args.firstName)},</p>`,
        `<p>${escapeHtml(siteConfig.name)} has set up your client portal for <strong>${business}</strong>.</p>`,
        `<p>Use the secure link below to choose a password and finish account setup.</p>`,
        `<p><a href="{{LINK}}">${escapeHtml(cta)}</a></p>`,
      ].join(""),
      textBody: [
        `Hi ${args.firstName},`,
        "",
        `${siteConfig.name} has set up your client portal for ${args.businessName}.`,
        "",
        "Use the link below to choose a password and finish setup:",
        "",
        "{{LINK}}",
      ].join("\n"),
    };
  }

  const cta = "Create your password";
  return {
    subject: "Your Signal Works client portal is ready",
    cta,
    htmlBody: [
      `<p>Hi ${escapeHtml(args.firstName)},</p>`,
      `<p>Your <strong>${business}</strong> client portal is ready.</p>`,
      `<p>Create your password to access billing, website requests, project updates, and important documents.</p>`,
      `<p><a href="{{LINK}}">${escapeHtml(cta)}</a></p>`,
    ].join(""),
    textBody: [
      `Hi ${args.firstName},`,
      "",
      `Your ${args.businessName} client portal is ready.`,
      "",
      "Create your password to access billing, website requests, project updates, and important documents.",
      "",
      `${cta}:`,
      "{{LINK}}",
    ].join("\n"),
  };
}

export async function sendClientInviteEmail(args: {
  email: string;
  fullName: string;
  businessName: string;
  inviteLink: string;
  linkType: ClientInviteEmailLinkType;
}): Promise<{ ok: boolean; error?: string }> {
  const resendKey = process.env.RESEND_API_KEY?.trim();
  const from = inviteFromAddress();

  if (!resendKey || !from) {
    return { ok: false, error: "Resend is not configured." };
  }

  const emailNorm = args.email.trim().toLowerCase();
  const firstName = args.fullName.trim().split(/\s+/)[0] || "there";
  const portalName = `${siteConfig.name} ${siteConfig.productName}`;
  const copy = inviteEmailCopy({
    linkType: args.linkType,
    firstName,
    businessName: args.businessName,
    portalName,
  });

  const html = copy.htmlBody.replaceAll("{{LINK}}", args.inviteLink);
  const text = copy.textBody.replaceAll("{{LINK}}", args.inviteLink);

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
      subject: copy.subject,
      click_tracking: false,
      open_tracking: false,
      html: [
        html,
        `<p>Any questions? Please contact us at <a href="mailto:${siteConfig.supportEmail}">${siteConfig.supportEmail}</a>.</p>`,
      ].join(""),
      text: [
        text,
        "",
        `Any questions? Please contact us at ${siteConfig.supportEmail}.`,
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
