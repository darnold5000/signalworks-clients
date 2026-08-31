import { z } from "zod";

export const contactInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  phone: z.string().trim().max(50).optional().default(""),
  jobTitle: z.string().trim().max(120).optional().default(""),
  isPrimary: z.boolean().default(false),
  receivesProposals: z.boolean().default(false),
  receivesBilling: z.boolean().default(false),
  receivesNotifications: z.boolean().default(false),
});
