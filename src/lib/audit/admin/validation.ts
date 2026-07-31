import { z } from "zod";

export const adminRunAuditSchema = z
  .object({
    rawUrl: z.string().trim().min(1, "Website URL is required."),
    scopeChoice: z.enum(["website", "client_health"]),
    tenantId: z.string().uuid().nullable().optional(),
    businessName: z.string().trim().max(200).nullish(),
    internalNotes: z.string().trim().max(4000).nullish(),
  })
  .superRefine((value, ctx) => {
    if (value.scopeChoice === "client_health" && !value.tenantId) {
      ctx.addIssue({
        code: "custom",
        message: "Client Health audits require a tenant.",
        path: ["tenantId"],
      });
    }
  });

export const recommendationStatusSchema = z.enum([
  "recommended",
  "planned",
  "in_progress",
  "completed",
  "dismissed",
  "client_action_required",
]);

export type AdminRunAuditInput = z.infer<typeof adminRunAuditSchema>;

export function toAuditType(scopeChoice: AdminRunAuditInput["scopeChoice"]) {
  return scopeChoice === "client_health" ? "client_health" : "public";
}
