import { z } from "zod";

export const nonTeachingStaffInputSchema = z.object({
  name: z.string().min(1),
  position: z.string().min(1),
  photoId: z.string().nullable(),
  email: z.union([z.string().email(), z.literal("")]).default(""),
  phone: z.string().max(50).default(""),
  showContact: z.boolean().default(false),
});
export type NonTeachingStaffInput = z.infer<typeof nonTeachingStaffInputSchema>;
