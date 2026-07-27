"use client";

import Link from "next/link";
import type { OnboardingAction } from "@/lib/portal/onboarding-actions";
import {
  onboardingActionButtonLabel,
  onboardingActionHref,
} from "@/lib/portal/onboarding-actions";
import { Panel } from "@/components/ui";

export function ActionRequiredCard({
  nextAction,
}: {
  nextAction: OnboardingAction;
}) {
  if (nextAction === "none") return null;

  const href = onboardingActionHref(nextAction);
  if (!href) return null;

  return (
    <Panel title="Activate Your Website" className="mb-6 border-amber-200 bg-amber-50/40">
      <p className="text-sm text-muted">
        You&apos;re almost done! Complete your account setup to activate your
        Signal Works account, manage your website, and begin your monthly
        service.
      </p>
      <Link
        href={href}
        className="mt-4 inline-flex rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover"
      >
        {onboardingActionButtonLabel(nextAction)}
      </Link>
    </Panel>
  );
}
