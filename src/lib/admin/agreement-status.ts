import type {
  ClientOfferStatus,
  TenantInternalStatus,
} from "@/lib/database/phase1-types";
import type { ClientStatus } from "@/lib/types";

export const OUTSTANDING_AGREEMENT_STATUSES: readonly ClientOfferStatus[] = [
  "published",
  "viewed",
];

export function hasOutstandingAgreement(statuses: readonly ClientOfferStatus[]): boolean {
  return statuses.some((status) => OUTSTANDING_AGREEMENT_STATUSES.includes(status));
}

export function resolveAgreementAwareInternalStatus(args: {
  storedStatus: TenantInternalStatus | null;
  tenantStatus: ClientStatus;
  offerStatuses: readonly ClientOfferStatus[];
}): TenantInternalStatus | null {
  if (hasOutstandingAgreement(args.offerStatuses)) return "awaiting_agreement";
  if (args.storedStatus !== "awaiting_agreement") return args.storedStatus;
  return args.tenantStatus;
}
