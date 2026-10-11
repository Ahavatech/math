import { z } from "zod";
import { isHttpsUrl } from "@/lib/url-validation";
import { validateEventTimes } from "@/lib/time";

function optionalHttpsUrl(message: string) {
  return z
    .string()
    .default("")
    .refine((v) => v === "" || isHttpsUrl(v), { message });
}

export const eventInputSchema = z
  .object({
    title: z.string().min(1),
    type: z.enum(["SEMINAR", "COLLOQUIUM", "SPECIAL_LECTURE", "CONFERENCE", "GRADUATION", "OTHER"]),
    startsAt: z.date(),
    endsAt: z.date().nullable(),
    venue: z.string().default(""),
    speakerName: z.string().default(""),
    speakerAffiliation: z.string().default(""),
    description: z.string().default(""),
    flyerId: z.string().nullable(),
    registrationUrl: optionalHttpsUrl("Registration link must be an https URL"),
    slidesUrl: optionalHttpsUrl("Slides link must be an https URL"),
    recordingUrl: optionalHttpsUrl("Recording link must be an https URL"),
    seriesId: z.string().nullable(),
    status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  })
  .refine((data) => validateEventTimes(data.startsAt, data.endsAt) === null, {
    message: "End time must be after start time",
    path: ["endsAt"],
  });
export type EventInput = z.infer<typeof eventInputSchema>;

export const eventSeriesInputSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(""),
});
export type EventSeriesInput = z.infer<typeof eventSeriesInputSchema>;

export const galleryImageInputSchema = z.object({
  mediaId: z.string().min(1),
  caption: z.string().min(1),
});
