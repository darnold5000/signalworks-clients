const EFFECTIVE_DATE_TOKEN = "__EFFECTIVE_DATE__";

/** Platform Terms of Service body (markdown). Effective date injected at render time. */
const TOS_MARKDOWN = `
# SIGNAL WORKS

# Terms of Service

**Effective Date:** ${EFFECTIVE_DATE_TOKEN}

These Terms of Service ("Agreement") govern the use of services provided by **Signal Works** ("Signal Works," "Company," "we," "our," or "us") to the individual or entity accepting this Agreement ("Client," "you," or "your").

By purchasing, accessing, or using any services provided by Signal Works, you agree to be bound by this Agreement.

---

## 1. Services

Signal Works provides software development, website design, hosting, client portals, scheduling systems, business automation, integrations, analytics, maintenance, consulting, and related technology services (collectively, the "Services").

Services may include website design and development, client portals, booking systems, payment integrations, CRM functionality, business dashboards, analytics, AI-powered features, hosting and maintenance, ongoing software updates, and technical consulting.

Specific Services purchased by the Client will be identified in one or more Statements of Work ("SOW"), proposals, invoices, or subscription plans.

---

## 2. Statements of Work

Each project or subscription may include a Statement of Work describing services, deliverables, pricing, timeline, monthly subscription fees, one-time implementation fees, included products, and optional add-ons.

If a Statement of Work conflicts with these Terms, the Statement of Work controls only for the conflicting provision.

---

## 3. Client Responsibilities

The Client agrees to provide accurate information, supply requested content in a timely manner, maintain legal rights to submitted materials, review deliverables within a reasonable time, notify Signal Works of issues promptly, and maintain secure passwords and account credentials. Delays caused by the Client may extend project timelines.

---

## 4. Subscription Services

Certain Services are provided on a recurring subscription basis. Unless otherwise agreed in writing, subscriptions renew automatically on a month-to-month basis, fees are billed in advance, and additional products or services may increase recurring fees with the Client's approval.

---

## 5. Payment Terms

Invoices are due according to the payment schedule provided. Late payments may result in suspension of Services, hosting, client portals, software updates, or technical support. Signal Works may charge reasonable late fees where permitted by law. The Client is responsible for all taxes except taxes imposed on Signal Works' income.

---

## 6. Hosting and Infrastructure

Signal Works may host applications using third-party infrastructure providers. Although Signal Works uses commercially reasonable efforts to maintain reliable services, uninterrupted availability cannot be guaranteed.

---

## 7. Third-Party Services

Projects may integrate with third-party providers. Signal Works is not responsible for outages, pricing changes, policy changes, API changes, or discontinuation of third-party services. The Client remains responsible for maintaining required third-party accounts unless otherwise agreed.

---

## 8. Intellectual Property

Signal Works retains ownership of proprietary software, frameworks, reusable code, APIs, internal tools, templates, libraries, infrastructure, development processes, documentation, trade secrets, and platform architecture unless specifically transferred in writing.

---

## 9. Client Content

The Client retains ownership of logos, trademarks, photos, videos, customer data, uploaded files, marketing materials, written content, business information, and customer records. The Client grants Signal Works a limited license to use such materials solely to provide the Services.

---

## 10. Platform License

Signal Works grants the Client a limited, non-exclusive, non-transferable license to use the Platform during an active subscription. The Client may not copy, reverse engineer, resell, sublicense, redistribute, modify, or decompile proprietary Platform software except where prohibited by applicable law.

---

## 11. Data Ownership

The Client owns all business data generated through use of the Platform. Signal Works claims no ownership interest in Client business data.

---

## 12. Privacy and Security

Signal Works implements commercially reasonable safeguards designed to protect Client data. No internet-connected system can be guaranteed to be completely secure.

---

## 13. Backups

Signal Works performs commercially reasonable backup procedures. Backups are intended for disaster recovery and are not guaranteed archival storage.

---

## 14. Acceptable Use

The Client agrees not to use the Services to violate applicable law, transmit malicious software, engage in fraudulent activity, infringe intellectual property rights, interfere with Platform operation, distribute spam, abuse computing resources, or attempt unauthorized access.

---

## 15. Support

Support is provided according to the Client's subscription plan. Support does not include unrelated software, personal devices, third-party hardware, or custom development outside the agreed scope unless purchased separately.

---

## 16. Changes and Enhancements

Signal Works may modify or improve the Platform over time. Signal Works will use commercially reasonable efforts to avoid materially reducing core functionality without notice.

---

## 17. Business Continuity and Company Dissolution

In the event Signal Works permanently ceases operations, Signal Works will use commercially reasonable efforts to provide advance notice when possible, export Client business data in a commonly used electronic format, and provide reasonable transition assistance if requested.

---

## 18. Termination

Either party may terminate month-to-month Services by providing at least thirty (30) days' written notice unless a different notice period is specified in the applicable Statement of Work. Outstanding invoices remain due.

---

## 19. Warranty Disclaimer

THE SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE." TO THE MAXIMUM EXTENT PERMITTED BY LAW, SIGNAL WORKS DISCLAIMS ALL WARRANTIES, WHETHER EXPRESS, IMPLIED, OR STATUTORY.

---

## 20. Limitation of Liability

TO THE MAXIMUM EXTENT PERMITTED BY LAW, SIGNAL WORKS' TOTAL LIABILITY ARISING FROM THIS AGREEMENT SHALL NOT EXCEED THE TOTAL AMOUNT PAID BY THE CLIENT TO SIGNAL WORKS DURING THE TWELVE (12) MONTHS PRECEDING THE EVENT GIVING RISE TO THE CLAIM.

---

## 21. Indemnification

The Client agrees to defend, indemnify, and hold harmless Signal Works from claims arising out of Client content, Client misuse of the Services, violations of law, or infringement caused by Client-provided materials.

---

## 22. Confidentiality

Each party agrees to protect confidential information received from the other party and to use such information solely for purposes of performing under this Agreement.

---

## 23. Governing Law

This Agreement shall be governed by the laws of the State of Indiana, without regard to conflict of law principles.

---

## 24. Dispute Resolution

Before initiating litigation, the parties agree to attempt in good faith to resolve disputes through informal negotiations.

---

## 25. Force Majeure

Neither party shall be liable for delays or failures caused by events beyond reasonable control.

---

## 26. Changes to These Terms

Signal Works may update these Terms from time to time. Material changes will become effective upon notice to existing Clients or upon publication on the Signal Works website.

---

## 27. Entire Agreement

This Agreement, together with any applicable Statement of Work, subscription agreement, proposal, or invoice, constitutes the complete agreement between the parties.

---

## 28. Severability

If any provision of this Agreement is held unenforceable, the remaining provisions shall remain in full force and effect.

---

## 29. Assignment

The Client may not assign this Agreement without Signal Works' prior written consent. Signal Works may assign this Agreement in connection with a merger, acquisition, or sale of substantially all of its assets.

---

## 30. Electronic Acceptance

The parties agree that electronic signatures, electronic acceptance, or acceptance through the Signal Works client portal shall have the same legal effect as handwritten signatures.

By accepting these Terms, the Client acknowledges that they have read, understood, and agree to be bound by this Agreement.
`.trim();

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function markdownToHtml(markdown: string): string {
  const lines = markdown.split("\n");
  const parts: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed === "---") {
      parts.push("<hr />");
      continue;
    }
    if (trimmed.startsWith("## ")) {
      parts.push(`<h2>${escapeHtml(trimmed.slice(3))}</h2>`);
      continue;
    }
    if (trimmed.startsWith("# ")) {
      parts.push(`<h1>${escapeHtml(trimmed.slice(2))}</h1>`);
      continue;
    }
    const withBold = escapeHtml(trimmed).replace(
      /\*\*(.+?)\*\*/g,
      "<strong>$1</strong>",
    );
    parts.push(`<p>${withBold}</p>`);
  }

  return parts.join("\n");
}

export function formatLegalEffectiveDate(date: Date = new Date()): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function renderSignalWorksTosHtml(
  effectiveDate = formatLegalEffectiveDate(),
): string {
  const markdown = TOS_MARKDOWN.replace(EFFECTIVE_DATE_TOKEN, effectiveDate);
  return markdownToHtml(markdown);
}

export function renderSignalWorksTosText(
  effectiveDate = formatLegalEffectiveDate(),
): string {
  return TOS_MARKDOWN.replace(EFFECTIVE_DATE_TOKEN, effectiveDate).replace(
    /\*\*/g,
    "",
  );
}
