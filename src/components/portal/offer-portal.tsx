"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type {
  ClientOffer,
  ClientOfferItem,
  LegalDocument,
} from "@/lib/database/phase1-types";
import type { OnboardingState } from "@/lib/portal/onboarding-state";
import type { Client } from "@/lib/types";
import { Button, Panel } from "@/components/ui";
import { OfferCheckoutButton } from "@/components/offer-checkout-button";
import { formatMoney } from "@/lib/utils";
import { calculateAmountDueFirstCycle } from "@/lib/offers/calculate-totals";
import { getClientVisibleOfferDescription } from "@/lib/offers/client-offer-copy";

type OfferPayload = {
  client: Client;
  offer: (ClientOffer & { items: ClientOfferItem[] }) | null;
  terms: LegalDocument | null;
  sow: LegalDocument | null;
  onboarding: OnboardingState;
};

export function OfferPortal() {
  const [data, setData] = useState<OfferPayload | null>(null);
  const [acceptedName, setAcceptedName] = useState("");
  const [acceptedEmail, setAcceptedEmail] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptSow, setAcceptSow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [company, setCompany] = useState({
    legalBusinessName: "",
    primaryContactName: "",
    primaryContactEmail: "",
    primaryContactPhone: "",
    websiteUrl: "",
    primaryDomain: "",
  });

  async function load() {
    const res = await fetch("/api/portal/offer");
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Could not load offer");
    setData(json);
    setCompany({
      legalBusinessName:
        json.onboarding.profile?.legal_business_name ??
        json.client.business_name ??
        "",
      primaryContactName:
        json.onboarding.profile?.primary_contact_name ?? "",
      primaryContactEmail:
        json.onboarding.profile?.primary_contact_email ??
        json.client.support_email ??
        "",
      primaryContactPhone:
        json.onboarding.profile?.primary_contact_phone ?? "",
      websiteUrl: json.client.website_url ?? "",
      primaryDomain: json.client.domain ?? "",
    });
    setAcceptedName(json.onboarding.profile?.primary_contact_name ?? "");
    setAcceptedEmail(
      json.onboarding.profile?.primary_contact_email ??
        json.client.support_email ??
        "",
    );
    if (json.offer) {
      await fetch("/api/portal/offer/view", { method: "POST" });
    }
  }

  useEffect(() => {
    load().catch((err) =>
      setError(err instanceof Error ? err.message : "Could not load offer"),
    );
  }, []);

  async function saveCompany() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/portal/offer", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(company),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not save company info");
      await load();
      setMessage("Company information saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function acceptAgreements() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/portal/agreements/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acceptedName,
          acceptedEmail,
          acceptTerms,
          acceptSow,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not accept agreements");
      await load();
      setMessage("Agreements accepted. You can continue to checkout.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not accept agreements");
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return <p className="text-sm text-muted">Loading your proposal…</p>;
  }

  const { offer, onboarding } = data;
  const offerDescription = offer
    ? getClientVisibleOfferDescription(offer.description)
    : null;
  const needsCompany =
    onboarding.nextAction === "confirm_company" ||
    onboarding.onboardingStatus === "invited" ||
    onboarding.onboardingStatus === "account_created";
  const needsAgreements =
    offer &&
    !onboarding.agreementsAccepted &&
    (onboarding.requiresTerms || onboarding.requiresSow);
  const canCheckout =
    offer &&
    onboarding.agreementsAccepted &&
    onboarding.nextAction === "complete_checkout";

  return (
    <div className="space-y-6">
      {needsCompany ? (
        <div id="company">
          <Panel title="Confirm company information">
            <div className="grid gap-3 md:grid-cols-2">
              {(
                [
                  ["legalBusinessName", "Legal business name"],
                  ["primaryContactName", "Primary contact name"],
                  ["primaryContactEmail", "Primary contact email"],
                  ["primaryContactPhone", "Phone"],
                  ["websiteUrl", "Website URL"],
                  ["primaryDomain", "Domain"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="text-sm">
                  <span className="mb-1 block text-muted">{label}</span>
                  <input
                    value={company[key]}
                    onChange={(e) =>
                      setCompany((current) => ({
                        ...current,
                        [key]: e.target.value,
                      }))
                    }
                    className="w-full rounded-md border border-border bg-background px-3 py-2"
                  />
                </label>
              ))}
            </div>
            <Button className="mt-4" onClick={saveCompany} disabled={busy}>
              Save and continue
            </Button>
          </Panel>
        </div>
      ) : null}

      {!offer ? (
        <Panel title="Proposal">
          <p className="text-sm text-muted">
            No published proposal is available yet. Signal Works will publish
            your offer when it is ready.
          </p>
        </Panel>
      ) : (
        <>
          <Panel title={offer.title}>
            {offerDescription ? (
              <p className="mb-4 text-sm text-muted">{offerDescription}</p>
            ) : (
              <p className="mb-4 text-sm text-muted">
                Review your plan, included services, and pricing below.
              </p>
            )}
            <ul className="divide-y divide-border">
              {offer.items
                .filter(
                  (item) =>
                    item.item_type !== "discount" && item.item_type !== "credit",
                )
                .map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-4 py-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-muted">
                        {item.billing_type}
                        {item.billing_interval
                          ? ` / ${item.billing_interval}`
                          : ""}
                      </p>
                    </div>
                    <p className="font-medium">
                      {formatMoney(
                        item.unit_amount_cents * item.quantity,
                        offer.currency,
                      )}
                    </p>
                  </li>
                ))}
            </ul>
            <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
              <p>
                One-time:{" "}
                <strong>
                  {formatMoney(offer.initial_total_cents, offer.currency)}
                </strong>
              </p>
              <p>
                Due at first cycle:{" "}
                <strong>
                  {formatMoney(
                    calculateAmountDueFirstCycle({
                      subtotal_cents: offer.subtotal_cents,
                      discount_total_cents: offer.discount_total_cents,
                      initial_total_cents: offer.initial_total_cents,
                      recurring_total_cents: offer.recurring_total_cents,
                    }),
                    offer.currency,
                  )}
                </strong>
              </p>
              <p>
                Recurring:{" "}
                <strong>
                  {formatMoney(offer.recurring_total_cents, offer.currency)}
                </strong>
              </p>
            </div>
          </Panel>

          {needsAgreements ? (
            <Panel title="Review and accept agreements">
              <p className="text-sm text-muted">
                Read the Terms of Service and Statement of Work, then confirm
                below to continue to Stripe checkout. Your Terms effective date
                will be the day you accept.
              </p>

              <div className="mt-4 space-y-3 text-sm">
                {onboarding.requiresTerms ? (
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={acceptTerms}
                      onChange={(e) => setAcceptTerms(e.target.checked)}
                    />
                    <span>
                      I have read and agree to the{" "}
                      <Link
                        href="/legal/terms"
                        target="_blank"
                        className="underline underline-offset-2"
                      >
                        Signal Works Terms of Service
                      </Link>
                      .
                    </span>
                  </label>
                ) : null}
                {onboarding.requiresSow ? (
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={acceptSow}
                      onChange={(e) => setAcceptSow(e.target.checked)}
                    />
                    <span>
                      I have read and agree to the{" "}
                      <Link
                        href="/legal/sow"
                        target="_blank"
                        className="underline underline-offset-2"
                      >
                        Statement of Work
                      </Link>{" "}
                      for this proposal.
                    </span>
                  </label>
                ) : null}
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <input
                  value={acceptedName}
                  onChange={(e) => setAcceptedName(e.target.value)}
                  placeholder="Your full name"
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
                <input
                  value={acceptedEmail}
                  onChange={(e) => setAcceptedEmail(e.target.value)}
                  placeholder="Your email"
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <Button
                className="mt-4"
                onClick={acceptAgreements}
                disabled={
                  busy ||
                  !acceptedName.trim() ||
                  !acceptedEmail.trim() ||
                  (onboarding.requiresTerms && !acceptTerms) ||
                  (onboarding.requiresSow && !acceptSow)
                }
              >
                Accept and continue
              </Button>
            </Panel>
          ) : null}

          {canCheckout ? (
            <Panel title="Checkout">
              <p className="text-sm text-muted">
                Agreements are on file. Continue to Stripe to add your payment
                method and complete setup.
              </p>
              <div className="mt-4">
                <OfferCheckoutButton label="Continue to Stripe checkout" />
              </div>
            </Panel>
          ) : null}
        </>
      )}

      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {message ? <p className="text-sm text-success">{message}</p> : null}
    </div>
  );
}
