export type OfferCheckoutReturnContext =
  | { kind: "portal" }
  | { kind: "public_proposal"; token: string };

export function buildOfferCheckoutReturnUrls(args: {
  appUrl: string;
  finalStage: boolean;
  returnContext?: OfferCheckoutReturnContext;
}): { success_url: string; cancel_url: string } {
  const context = args.returnContext ?? { kind: "portal" as const };
  if (context.kind === "public_proposal") {
    const encodedToken = encodeURIComponent(context.token);
    const base = `${args.appUrl}/proposal/${encodedToken}`;
    return {
      success_url: args.finalStage
        ? `${base}/checkout/success?session_id={CHECKOUT_SESSION_ID}`
        : `${base}/checkout/continue?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: base,
    };
  }

  return {
    success_url: args.finalStage
      ? `${args.appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`
      : `${args.appUrl}/billing/continue?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${args.appUrl}/offer`,
  };
}
