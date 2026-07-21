"use client";

import { useEffect, useState } from "react";
import type {
  ClientOffer,
  ClientOfferItem,
  LegalDocument,
} from "@/lib/database/phase1-types";
import type { OnboardingState } from "@/lib/portal/onboarding-state";
import type { Client } from "@/lib/types";
import { Button, Panel } from "@/components/ui";
import { formatMoney } from "@/lib/utils";

type OfferPayload = {
  client: Client;
  offer: (ClientOffer & { items: ClientOfferItem[] }) | null;
  terms: LegalDocument | null;
  onboarding: OnboardingState;
};

export function OfferPortal() {
  const [data, setData] = useState<OfferPayload | null>(null);
  const [acceptedName, setAcceptedName] = useState("");
  const [acceptedEmail, setAcceptedEmail] = useState("");
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

  async function acceptTerms() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/portal/agreements/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acceptedName, acceptedEmail }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not accept terms");
      await load();
      setMessage("Terms accepted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not accept terms");
    } finally {
      setBusy(false);
    }
  }

  async function startCheckout() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/portal/offer/checkout", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not start checkout");
      if (json.url) window.location.assign(json.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start checkout");
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return <p className="text-sm text-muted">Loading your proposal…</p>;
  }

  const { offer, terms, onboarding } = data;
  const needsCompany =
    onboarding.nextAction === "confirm_company" ||
    onboarding.onboardingStatus === "invited" ||
    onboarding.onboardingStatus === "account_created";

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
            {offer.description ? (
              <p className="mb-4 text-sm text-muted">{offer.description}</p>
            ) : null}
            <ul className="divide-y divide-border">
              {offer.items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-muted">
                      {item.billing_type}
                      {item.billing_interval ? ` / ${item.billing_interval}` : ""}
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
            <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <p>
                Due today:{" "}
                <strong>
                  {formatMoney(offer.initial_total_cents, offer.currency)}
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

          {offer.requires_terms_acceptance && terms && !onboarding.termsAccepted ? (
            <Panel title={terms.title}>
              <div
                className="prose prose-sm max-w-none text-sm"
                dangerouslySetInnerHTML={{ __html: terms.content_html }}
              />
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
              <Button className="mt-4" onClick={acceptTerms} disabled={busy}>
                Accept terms
              </Button>
            </Panel>
          ) : null}

          {(onboarding.termsAccepted || !offer.requires_terms_acceptance) &&
          onboarding.nextAction === "complete_checkout" ? (
            <Panel title="Checkout">
              <p className="text-sm text-muted">
                Start secure checkout when you are ready. Stripe handles payment
                details.
              </p>
              <Button className="mt-4" onClick={startCheckout} disabled={busy}>
                Continue to checkout
              </Button>
            </Panel>
          ) : null}
        </>
      )}

      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {message ? <p className="text-sm text-success">{message}</p> : null}
    </div>
  );
}
