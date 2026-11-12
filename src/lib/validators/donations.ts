import { z } from "zod";

/**
 * The donations page is a bank-details page: it explains what gifts
 * support and shows where to send a transfer. It takes no payments and
 * stores no donor data (SCOPE.md excludes online payments).
 *
 * Because these values tell the public where to send money, they are
 * validated tightly: account fields cannot hold markup or line breaks, and
 * the page cannot be switched on until the three details a transfer needs
 * are present.
 */

const emailOrEmpty = z
  .string()
  .trim()
  .max(254)
  .refine((value) => value === "" || z.string().email().safeParse(value).success, {
    message: "Must be empty or a valid email",
  });

export const donationPurposeSchema = z.object({
  title: z.string().trim().min(1, "Each purpose needs a title").max(120),
  description: z.string().trim().max(400),
});

export const donationsSettingsSchema = z
  .object({
    enabled: z.boolean(),
    heading: z.string().trim().max(120),
    intro: z.string().trim().max(3000),
    purposes: z.array(donationPurposeSchema).max(8),
    accountName: z.string().trim().max(120),
    bankName: z.string().trim().max(120),
    accountNumber: z
      .string()
      .trim()
      .max(34)
      .regex(/^[0-9A-Za-z -]*$/, "Use only letters, digits, spaces and hyphens"),
    swiftCode: z
      .string()
      .trim()
      .max(11)
      .regex(/^[0-9A-Za-z]*$/, "Use only letters and digits"),
    reference: z.string().trim().max(200),
    receiptsNote: z.string().trim().max(400),
    contactEmail: emailOrEmpty,
  })
  .refine((value) => !value.enabled || (value.accountName && value.bankName && value.accountNumber), {
    message: "Account name, bank and account number are required before the page can be turned on",
    path: ["enabled"],
  });

export type DonationsSettings = z.infer<typeof donationsSettingsSchema>;

export const DONATIONS_DEFAULT: DonationsSettings = {
  enabled: false,
  heading: "Support the department",
  intro: "",
  purposes: [],
  accountName: "",
  bankName: "",
  accountNumber: "",
  swiftCode: "",
  reference: "",
  receiptsNote: "",
  contactEmail: "",
};
