"use client";

import Link from "next/link";
import type { OnboardingAction } from "@/lib/portal/onboarding-actions";
import {
  onboardingActionButtonLabel,
  onboardingActionHref,
  onboardingActionLabel,
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
    <Panel title="Action required" className="mb-6 border-amber-200 bg-amber-50/40">
      <p className="text-sm text-muted">
        Welcome — just one more step to finish getting set up.
      </p>
      <p className="mt-2 text-sm">
        {onboardingActionLabel(nextAction)}.
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
