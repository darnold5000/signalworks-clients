import { notFound } from "next/navigation";
import { ProposalClientView } from "@/components/portal/proposal-client-view";
import { PublicProposalAcceptance } from "@/components/portal/public-proposal-acceptance";
import { getPublicProposal } from "@/lib/proposals/public-access";
import { resolveOfferBillingMethod } from "@/lib/offers/billing-method";

export default async function PublicProposalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const proposal = await getPublicProposal(token, true);
  if (!proposal) notFound();
  const terminal = proposal.offer.status === "accepted" || proposal.offer.status === "purchased";
  return <main className="mx-auto max-w-5xl px-4 py-10">
    <ProposalClientView offer={proposal.offer} items={proposal.offer.items} features={proposal.offer.features} acceptance={terminal ? <p className="text-sm font-medium text-success">This proposal has already been completed.</p> : <PublicProposalAcceptance token={token} recipientName={proposal.recipient.name ?? ""} recipientEmail={proposal.recipient.email} requiresTerms={proposal.offer.requires_terms_acceptance && Boolean(proposal.terms)} requiresSow={Boolean(proposal.sow)} proposalOnly={resolveOfferBillingMethod(proposal.offer) === "proposal_only"} />} />
  </main>;
}
