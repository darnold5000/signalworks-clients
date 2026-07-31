import { z } from "zod";

export const publicRunAuditSchema = z.object({
  rawUrl: z.string().trim().min(1, "Website URL is required."),
  businessName: z.string().trim().max(200).optional(),
  contactName: z.string().trim().max(120).optional(),
  contactEmail: z.string().trim().email("Enter a valid email address.").optional().or(z.literal("")),
  city: z.string().trim().max(120).optional(),
  utmSource: z.string().trim().max(120).optional(),
  utmMedium: z.string().trim().max(120).optional(),
  utmCampaign: z.string().trim().max(120).optional(),
  companyWebsite: z.string().optional(),
}).superRefine((value, ctx) => {
  if (value.companyWebsite?.trim()) {
    ctx.addIssue({
      code: "custom",
      message: "Invalid submission.",
      path: ["companyWebsite"],
    });
  }
});

export type PublicRunAuditInput = z.infer<typeof publicRunAuditSchema>;
