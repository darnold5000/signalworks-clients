import type { ClientOffer, ClientOfferItem } from "@/lib/database/phase1-types";
import {
  calculateAmountDueFirstCycle,
  calculateOfferTotals,
} from "@/lib/offers/calculate-totals";
import { DISCOUNT_SCOPE, discountScopeFromMetadata } from "@/lib/offers/discount-scope";
import { formatLegalEffectiveDate } from "@/lib/legal/signal-works-tos";
import {
  isBundledProductItem,
  isPaidAddOnItem,
} from "@/lib/offers/offer-item-metadata";
import { formatDate } from "@/lib/utils";

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

function buildProductRows(items: ClientOfferItem[]): string {
  const products = items.filter(
    (item) => item.is_selected && isBundledProductItem(item),
  );
  if (products.length === 0) {
    return `<tr><td>Standard plan services</td></tr>`;
  }
  return products
    .map((item) => `<tr><td>${escapeHtml(item.name)}</td></tr>`)
    .join("");
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
        <td style="text-align:right">$${formatDollars(item.unit_amount_cents * item.quantity)}</td>
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
        <td style="text-align:right">$${formatDollars(item.unit_amount_cents * item.quantity)}</td>
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
        <td style="text-align:right">-$${formatDollars(amount)}</td>
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
  const basePlanItem = args.items.find(
    (item) => item.is_selected && item.item_type === "base_plan",
  );
  const basePlanCents = basePlanItem
    ? basePlanItem.unit_amount_cents * basePlanItem.quantity
    : 0;
  const addOnCents = args.items
    .filter((item) => item.is_selected && isPaidAddOnItem(item))
    .reduce((sum, item) => sum + item.unit_amount_cents * item.quantity, 0);
  const recurringDiscountCents = args.items
    .filter(
      (item) =>
        item.is_selected &&
        (item.item_type === "discount" || item.item_type === "credit") &&
        discountScopeFromMetadata(item) === DISCOUNT_SCOPE.RECURRING,
    )
    .reduce((sum, item) => sum + item.unit_amount_cents * item.quantity, 0);
  const projectStart =
    args.client.projectStart ?? new Date().toISOString().slice(0, 10);

  return {
    effectiveDate: args.effectiveDate ?? formatLegalEffectiveDate(),
    projectStart: formatDate(projectStart),
    estimatedGoLive:
      args.client.estimatedGoLive?.trim() ||
      estimateGoLiveDate(projectStart),
    basePlanCents,
    addOnCents,
    recurringDiscountCents,
    monthlyTotalCents: totals.recurring_total_cents,
    setupTotalCents: totals.initial_total_cents,
    initialTotalCents: dueBeforeBilling,
    productRows: buildProductRows(args.items),
    addOnRows: buildAddOnRows(args.items),
    oneTimeRows: buildOneTimeRows(args.items),
    discountRows: buildDiscountRows(args.items),
    hasAddOns: addOnCents > 0,
    hasOneTime: totals.initial_total_cents > 0,
    hasDiscounts: recurringDiscountCents > 0 || totals.discount_total_cents > 0,
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
  const monthlyPrice = formatDollars(ctx.basePlanCents);

  const addOnSection = ctx.hasAddOns
    ? `
    <h2>5. Recurring Add-On Services</h2>
    <p>The Client has elected to purchase the following optional recurring services.</p>
    <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;margin-bottom:1.5rem">
      <thead>
        <tr>
          <th align="left">Add-On</th>
          <th align="right">Monthly</th>
        </tr>
      </thead>
      <tbody>${ctx.addOnRows}</tbody>
    </table>`
    : "";

  const oneTimeSection = ctx.hasOneTime
    ? `
    <h2>6. One-Time Project Charges</h2>
    <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;margin-bottom:1.5rem">
      <thead>
        <tr>
          <th align="left">Description</th>
          <th align="right">Amount</th>
        </tr>
      </thead>
      <tbody>${ctx.oneTimeRows}</tbody>
    </table>`
    : "";

  const discountSection = ctx.hasDiscounts
    ? `
    <h2>7. Discounts</h2>
    <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;margin-bottom:1.5rem">
      <thead>
        <tr>
          <th align="left">Description</th>
          <th align="right">Amount</th>
        </tr>
      </thead>
      <tbody>${ctx.discountRows}</tbody>
    </table>`
    : "";

  const sectionNumbers = {
    pricing: ctx.hasDiscounts ? 8 : ctx.hasOneTime ? 7 : ctx.hasAddOns ? 6 : 5,
    standard: ctx.hasDiscounts ? 9 : ctx.hasOneTime ? 8 : ctx.hasAddOns ? 7 : 6,
    clientResp:
      ctx.hasDiscounts ? 10 : ctx.hasOneTime ? 9 : ctx.hasAddOns ? 8 : 7,
    timeline:
      ctx.hasDiscounts ? 11 : ctx.hasOneTime ? 10 : ctx.hasAddOns ? 9 : 8,
    excluded:
      ctx.hasDiscounts ? 12 : ctx.hasOneTime ? 11 : ctx.hasAddOns ? 10 : 9,
    ownership:
      ctx.hasDiscounts ? 13 : ctx.hasOneTime ? 12 : ctx.hasAddOns ? 11 : 10,
    continuity:
      ctx.hasDiscounts ? 14 : ctx.hasOneTime ? 13 : ctx.hasAddOns ? 12 : 11,
    acceptance:
      ctx.hasDiscounts ? 15 : ctx.hasOneTime ? 14 : ctx.hasAddOns ? 13 : 12,
  };

  return `
    <h1>Statement of Work (SOW)</h1>
    <h2>Signal Works</h2>
    <p>This Statement of Work ("SOW") is entered into between <strong>Signal Works</strong> ("Provider") and the Client identified below. This SOW is governed by and incorporated into the Signal Works Terms of Service.</p>
    <p><strong>Effective Date:</strong> ${escapeHtml(ctx.effectiveDate)}</p>

    <h2>1. Client Information</h2>
    <p><strong>Business Name</strong><br />${displayValue(args.client.businessName)}</p>
    <p><strong>Primary Contact</strong><br />${displayValue(args.client.contactName)}</p>
    <p><strong>Email</strong><br />${displayValue(args.client.email)}</p>
    <p><strong>Phone</strong><br />${displayValue(args.client.phone)}</p>
    <p><strong>Website</strong><br />${displayValue(args.client.website)}</p>
    <p><strong>Primary Domain</strong><br />${displayValue(args.client.domain)}</p>

    <h2>2. Project Overview</h2>
    <p>Signal Works will design, build, deploy, host, maintain, and support the Client's digital platform based on the selected subscription plan and the products listed in this Statement of Work.</p>
    <p>Unless otherwise noted, all work will be performed using Signal Works' standard implementation process, technology stack, hosting infrastructure, security practices, deployment pipeline, and ongoing maintenance procedures.</p>

    <h2>3. Subscription Plan</h2>
    <p><strong>Selected Plan</strong><br />${displayValue(args.client.planName)}</p>
    <p><strong>Monthly Subscription</strong><br /><strong>$${monthlyPrice} / month</strong></p>
    <p>The selected plan includes the standard services, support, maintenance, software updates, hosting, monitoring, security updates, and platform improvements associated with that plan.</p>

    <h2>4. Included Products &amp; Services</h2>
    <p>The following products and services are included in the Client's subscription.</p>
    <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;margin-bottom:1.5rem">
      <thead><tr><th align="left">Included Services</th></tr></thead>
      <tbody>${ctx.productRows}</tbody>
    </table>
    <p>Unless otherwise stated, Signal Works will configure, deploy, and support these products as part of the Client's subscription.</p>

    ${addOnSection}
    ${oneTimeSection}
    ${discountSection}

    <h2>${sectionNumbers.pricing}. Pricing Summary</h2>
    <h3>Monthly Subscription</h3>
    <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;margin-bottom:1rem">
      <tbody>
        <tr><td>Base Plan</td><td style="text-align:right">$${formatDollars(ctx.basePlanCents)}</td></tr>
        <tr><td>Recurring Add-Ons</td><td style="text-align:right">$${formatDollars(ctx.addOnCents)}</td></tr>
        <tr><td>Recurring Discounts</td><td style="text-align:right">-$${formatDollars(ctx.recurringDiscountCents)}</td></tr>
      </tbody>
    </table>
    <h3>Total Monthly Subscription</h3>
    <p><strong>$${formatDollars(ctx.monthlyTotalCents)}</strong></p>

    <h3>One-Time Charges</h3>
    <p>$${formatDollars(ctx.setupTotalCents)}</p>
    <h3>Total Due Before Ongoing Billing</h3>
    <p><strong>$${formatDollars(ctx.initialTotalCents)}</strong></p>

    <h2>${sectionNumbers.standard}. Standard Services Included</h2>
    <p>Unless specifically excluded in writing, the following services are considered part of Signal Works' normal implementation process where applicable to the selected products.</p>
    <ul>
      <li>Website and application development</li>
      <li>Hosting configuration and management</li>
      <li>Domain and DNS configuration</li>
      <li>SSL certificate configuration</li>
      <li>Deployment to production</li>
      <li>Mobile-responsive implementation</li>
      <li>Security updates and software maintenance</li>
      <li>Performance monitoring and technical troubleshooting</li>
      <li>Platform updates and basic search engine optimization</li>
      <li>Analytics, payment processor, and email configuration</li>
      <li>Technical support according to the selected subscription plan</li>
    </ul>

    <h2>${sectionNumbers.clientResp}. Client Responsibilities</h2>
    <p>The Client agrees to provide branding assets, business information, requested content, timely approvals, and access to third-party accounts when required. Project timelines may be extended if required materials are delayed.</p>

    <h2>${sectionNumbers.timeline}. Estimated Timeline</h2>
    <p><strong>Project Start</strong><br />${escapeHtml(ctx.projectStart)}</p>
    <p><strong>Estimated Launch</strong><br />${escapeHtml(ctx.estimatedGoLive)}</p>
    <p>These dates are estimates and may change due to client-requested revisions, third-party dependencies, or unforeseen technical circumstances.</p>

    <h2>${sectionNumbers.excluded}. Items Specifically Excluded</h2>
    <p>Unless expressly listed elsewhere in this SOW, custom software outside the agreed products, third-party licensing fees, paid advertising, ongoing content creation, photography, extensive data entry, major post-approval redesigns, and custom integrations not listed here are not included. Additional work may be quoted separately.</p>

    <h2>${sectionNumbers.ownership}. Ownership</h2>
    <p>Upon payment of all outstanding invoices, the Client owns business content, branding, uploaded media, documents, customer information, and business data. Signal Works retains ownership of its software platform, reusable components, frameworks, infrastructure, and other proprietary intellectual property unless otherwise agreed in writing.</p>

    <h2>${sectionNumbers.continuity}. Business Continuity</h2>
    <p>If Signal Works permanently ceases operations, Signal Works will use commercially reasonable efforts to provide advance notice whenever reasonably possible, provide an export of Client business data in a commonly used electronic format, and provide reasonable transition assistance upon request.</p>

    <h2>${sectionNumbers.acceptance}. Acceptance</h2>
    <p>By accepting this Statement of Work, the Client agrees to the selected subscription plan, the included products and services, the pricing shown above, and the Signal Works Terms of Service. Electronic acceptance through the Signal Works Client Portal has the same legal effect as a handwritten signature.</p>
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
