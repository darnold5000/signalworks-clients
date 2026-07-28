import type { ClientOffer, ClientOfferItem } from "@/lib/database/phase1-types";
import {
  calculateAmountDueFirstCycle,
  calculateOfferTotals,
} from "@/lib/offers/calculate-totals";
import { formatLegalEffectiveDate } from "@/lib/legal/signal-works-tos";
import {
  groupIncludedPlatformItems,
  includedPlatformSummarySentence,
} from "@/lib/offers/included-platform-summary";
import { isPaidAddOnItem } from "@/lib/offers/offer-item-metadata";
import { buildOfferPricingSummary } from "@/lib/offers/pricing-summary";
import { formatDate } from "@/lib/utils";

const SOW_STYLES = `
  .sw-sow { font-family: Georgia, 'Times New Roman', serif; color: #111; line-height: 1.55; max-width: 46rem; margin: 0 auto; }
  .sw-sow header { text-align: center; margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 2px solid #111; }
  .sw-sow h1 { font-size: 1.5rem; letter-spacing: 0.08em; text-transform: uppercase; margin: 0 0 0.25rem; }
  .sw-sow .sw-subtitle { font-size: 1.125rem; margin: 0; }
  .sw-sow h2 { font-size: 1.05rem; margin: 1.75rem 0 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; }
  .sw-sow h3 { font-size: 1rem; margin: 1rem 0 0.5rem; }
  .sw-sow p { margin: 0.5rem 0; }
  .sw-sow table { width: 100%; border-collapse: collapse; margin: 0.75rem 0 1.25rem; font-size: 0.95rem; }
  .sw-sow th, .sw-sow td { border: 1px solid #ccc; padding: 0.5rem 0.65rem; vertical-align: top; }
  .sw-sow th { background: #f5f5f5; text-align: left; }
  .sw-sow .sw-money { text-align: right; white-space: nowrap; }
  .sw-sow ul { margin: 0.5rem 0 1rem 1.25rem; }
  .sw-sow li { margin-bottom: 0.35rem; word-break: break-word; }
  .sw-sow table { page-break-inside: avoid; }
  .sw-sow h2 { page-break-after: avoid; }
  @media print {
    .sw-sow { max-width: none; }
    body { background: #fff; }
  }
`;

export type SowClientContext = {
  businessName: string;
  contactName: string;
  email: string;
  phone?: string | null;
  website?: string | null;
  domain?: string | null;
  planName: string;
  projectStart?: string | null;
  estimatedGoLive?: string | null;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function displayValue(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? escapeHtml(trimmed) : "—";
}

function formatDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

function estimateGoLiveDate(projectStart: string | null | undefined): string {
  if (!projectStart) {
    return "Approximately 4–6 weeks after project start";
  }
  const start = new Date(`${projectStart}T12:00:00Z`);
  if (Number.isNaN(start.getTime())) {
    return "Approximately 4–6 weeks after project start";
  }
  start.setUTCDate(start.getUTCDate() + 35);
  return formatDate(start.toISOString().slice(0, 10));
}

function buildIncludedScopeHtml(items: ClientOfferItem[]): string {
  const groups = groupIncludedPlatformItems(items);
  if (groups.length === 0) {
    return `<p>The selected plan includes standard Signal Works platform services for design, hosting, maintenance, and support.</p>`;
  }

  const summary = includedPlatformSummarySentence(groups);
  let html = `<p>Included with your plan: ${escapeHtml(summary)}.</p>`;
  html += `<ul>`;
  for (const group of groups) {
    html += `<li><strong>${escapeHtml(group.sectionLabel)}:</strong> ${escapeHtml(group.itemNames.join(", "))}</li>`;
  }
  html += `</ul>`;
  return html;
}

function buildAddOnRows(items: ClientOfferItem[]): string {
  const addOns = items.filter(
    (item) => item.is_selected && isPaidAddOnItem(item),
  );
  if (addOns.length === 0) return "";
  return addOns
    .map(
      (item) => `<tr>
        <td>${escapeHtml(item.name)}</td>
        <td class="sw-money">$${formatDollars(item.unit_amount_cents * item.quantity)}</td>
      </tr>`,
    )
    .join("");
}

function buildOneTimeRows(items: ClientOfferItem[]): string {
  const rows = items.filter(
    (item) =>
      item.is_selected &&
      item.billing_type === "one_time" &&
      item.item_type !== "discount" &&
      item.item_type !== "credit",
  );
  if (rows.length === 0) return "";
  return rows
    .map(
      (item) => `<tr>
        <td>${escapeHtml(item.description || item.name)}</td>
        <td class="sw-money">$${formatDollars(item.unit_amount_cents * item.quantity)}</td>
      </tr>`,
    )
    .join("");
}

function buildDiscountRows(items: ClientOfferItem[]): string {
  const discounts = items.filter(
    (item) =>
      item.is_selected &&
      (item.item_type === "discount" || item.item_type === "credit"),
  );
  if (discounts.length === 0) return "";
  return discounts
    .map((item) => {
      const amount = item.unit_amount_cents * item.quantity;
      const suffix =
        item.discount_duration_type === "repeating" &&
        item.discount_duration_months
          ? ` (${item.discount_duration_months} mo)`
          : "";
      return `<tr>
        <td>${escapeHtml(item.name)}${escapeHtml(suffix)}</td>
        <td class="sw-money">-$${formatDollars(amount)}</td>
      </tr>`;
    })
    .join("");
}

export function buildOfferSowContext(args: {
  client: SowClientContext;
  offer: Pick<
    ClientOffer,
    | "currency"
    | "subtotal_cents"
    | "discount_total_cents"
    | "initial_total_cents"
    | "recurring_total_cents"
  >;
  items: ClientOfferItem[];
  effectiveDate?: string;
}) {
  const totals = calculateOfferTotals(args.items);
  const dueBeforeBilling = calculateAmountDueFirstCycle(totals);
  const pricing = buildOfferPricingSummary(args.items, args.offer.currency);
  const projectStart =
    args.client.projectStart ?? new Date().toISOString().slice(0, 10);

  const discountDurationMonths = pricing.discountDurationMonths;
  const afterDiscountNote =
    pricing.recurringDiscountAmountCents > 0 && discountDurationMonths
      ? `<p>After ${discountDurationMonths} month${discountDurationMonths === 1 ? "" : "s"}, the monthly subscription returns to <strong>$${formatDollars(pricing.standardMonthlyAmountAfterDiscountCents)}</strong> unless otherwise agreed in writing.</p>`
      : "";

  return {
    effectiveDate: args.effectiveDate ?? formatLegalEffectiveDate(),
    projectStart: formatDate(projectStart),
    estimatedGoLive:
      args.client.estimatedGoLive?.trim() ||
      estimateGoLiveDate(projectStart),
    pricing,
    monthlyTotalCents: totals.recurring_total_cents,
    setupTotalCents: totals.initial_total_cents,
    initialTotalCents: dueBeforeBilling,
    includedScopeHtml: buildIncludedScopeHtml(args.items),
    addOnRows: buildAddOnRows(args.items),
    oneTimeRows: buildOneTimeRows(args.items),
    discountRows: buildDiscountRows(args.items),
    hasAddOns: pricing.recurringAddOnAmountCents > 0,
    hasOneTime: totals.initial_total_cents > 0,
    hasDiscounts: pricing.recurringDiscountAmountCents > 0,
    afterDiscountNote,
  };
}

export function renderOfferSowHtml(args: {
  client: SowClientContext;
  offer: Pick<
    ClientOffer,
    | "title"
    | "currency"
    | "subtotal_cents"
    | "discount_total_cents"
    | "initial_total_cents"
    | "recurring_total_cents"
  >;
  items: ClientOfferItem[];
  effectiveDate?: string;
}): string {
  const ctx = buildOfferSowContext(args);
  const p = ctx.pricing;

  const addOnSection = ctx.hasAddOns
    ? `
    <h2>4. Paid add-ons</h2>
    <p>Separately priced recurring services selected for this engagement.</p>
    <table>
      <thead>
        <tr>
          <th>Add-on</th>
          <th class="sw-money">Monthly</th>
        </tr>
      </thead>
      <tbody>${ctx.addOnRows}</tbody>
    </table>`
    : "";

  const oneTimeSection = ctx.hasOneTime
    ? `
    <h2>${ctx.hasAddOns ? "5" : "4"}. One-time charges</h2>
    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th class="sw-money">Amount</th>
        </tr>
      </thead>
      <tbody>${ctx.oneTimeRows}</tbody>
    </table>`
    : "";

  const pricingSectionNumber = ctx.hasOneTime
    ? ctx.hasAddOns
      ? "6"
      : "5"
    : ctx.hasAddOns
      ? "5"
      : "4";

  return `
    <style>${SOW_STYLES}</style>
    <article class="sw-sow">
    <header>
      <p class="sw-subtitle">Signal Works</p>
      <h1>Statement of Work</h1>
    </header>
    <p>This Statement of Work ("SOW") is entered into between <strong>Signal Works</strong> ("Provider") and the Client identified below. This SOW is governed by and incorporated into the Signal Works Terms of Service.</p>
    <p><strong>Effective date:</strong> ${escapeHtml(ctx.effectiveDate)}</p>
    <p><strong>Client:</strong> ${displayValue(args.client.businessName)}</p>

    <h2>1. Project overview</h2>
    <p>Signal Works will design, configure, deploy, host, maintain, and support the Client's selected digital platform, including the scope described in this document.</p>

    <h2>2. Client information</h2>
    <p><strong>Primary contact:</strong> ${displayValue(args.client.contactName)}<br />
    <strong>Email:</strong> ${displayValue(args.client.email)}<br />
    <strong>Phone:</strong> ${displayValue(args.client.phone)}<br />
    <strong>Website:</strong> ${displayValue(args.client.website)}<br />
    <strong>Primary domain:</strong> ${displayValue(args.client.domain)}</p>

    <h2>3. Included platform scope</h2>
    <p><strong>Selected plan:</strong> ${displayValue(args.client.planName)}</p>
    ${ctx.includedScopeHtml}

    ${addOnSection}
    ${oneTimeSection}

    <h2>${pricingSectionNumber}. Pricing</h2>
    <table>
      <tbody>
        <tr><td>${escapeHtml(p.planName)}</td><td class="sw-money">$${formatDollars(p.baseMonthlyAmountCents)}</td></tr>
        ${p.recurringAddOnAmountCents > 0 ? `<tr><td>Recurring add-ons</td><td class="sw-money">$${formatDollars(p.recurringAddOnAmountCents)}</td></tr>` : ""}
        ${p.recurringAddOnAmountCents > 0 ? `<tr><td>Monthly subtotal</td><td class="sw-money">$${formatDollars(p.standardMonthlyAmountAfterDiscountCents)}</td></tr>` : ""}
        ${p.recurringDiscountAmountCents > 0 ? `<tr><td>Introductory discount</td><td class="sw-money">-$${formatDollars(p.recurringDiscountAmountCents)}</td></tr>` : ""}
        <tr><td><strong>Your monthly price</strong></td><td class="sw-money"><strong>$${formatDollars(p.discountedMonthlyAmountCents)}</strong></td></tr>
      </tbody>
    </table>
    ${ctx.afterDiscountNote}
    ${p.oneTimeAmountCents > 0 ? `<p><strong>One-time charges:</strong> $${formatDollars(p.oneTimeAmountCents)}</p>` : ""}
    <p><strong>Amount due at checkout:</strong> $${formatDollars(p.dueAtCheckoutCents)}</p>

    <h2>${Number(pricingSectionNumber) + 1}. Standard services</h2>
    <p>Unless specifically excluded in writing, Signal Works provides implementation, hosting, security updates, monitoring, deployment, and standard support applicable to the selected platform scope.</p>

    <h2>${Number(pricingSectionNumber) + 2}. Assumptions and exclusions</h2>
    <p>Unless expressly listed elsewhere in this SOW, custom software outside the agreed scope, third-party licensing fees, paid advertising, ongoing content creation, photography, extensive data entry, major post-approval redesigns, and custom integrations not listed here are not included.</p>

    <h2>${Number(pricingSectionNumber) + 3}. Estimated timeline</h2>
    <p><strong>Project start:</strong> ${escapeHtml(ctx.projectStart)}<br />
    <strong>Estimated launch:</strong> ${escapeHtml(ctx.estimatedGoLive)}</p>

    <h2>${Number(pricingSectionNumber) + 4}. Acceptance</h2>
    <p>By accepting this Statement of Work, the Client agrees to the selected subscription plan, included scope, pricing above, and the Signal Works Terms of Service. Electronic acceptance through the Signal Works Client Portal has the same legal effect as a handwritten signature.</p>
    </article>
  `.trim();
}

export function renderOfferSowText(args: {
  client: SowClientContext;
  offer: Pick<ClientOffer, "title">;
  items: ClientOfferItem[];
}): string {
  const html = renderOfferSowHtml({
    ...args,
    offer: {
      ...args.offer,
      currency: "usd",
      subtotal_cents: 0,
      discount_total_cents: 0,
      initial_total_cents: 0,
      recurring_total_cents: 0,
    },
  });
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
