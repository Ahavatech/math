"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser, requirePermission } from "@/lib/rbac";
import { contextFromHeaders } from "@/server/services/audit";
import {
  createAlumniLink,
  createCohortLinks,
  regenerateAlumniLinkToken,
  setAlumniLinkActive,
  alumniSubmitUrl,
} from "@/server/services/alumni-links";

type ActionResult = { error?: string; success?: boolean; url?: string; links?: { label: string; year: number; url: string }[] };

async function requireAlumniReview() {
  const user = await getCurrentUser();
  return requirePermission(user, "alumni.review");
}

const createFormSchema = z.object({
  label: z.string().min(1),
  cohortYear: z.string().optional(),
  expiresInDays: z.string().optional(),
  maxUses: z.string().optional(),
});

export async function createAlumniLinkAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireAlumniReview();
  const parsed = createFormSchema.safeParse({
    label: formData.get("label"),
    cohortYear: formData.get("cohortYear")?.toString(),
    expiresInDays: formData.get("expiresInDays")?.toString(),
    maxUses: formData.get("maxUses")?.toString(),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  try {
    const { token } = await createAlumniLink(
      db,
      {
        label: parsed.data.label,
        cohortYear: parsed.data.cohortYear ? Number(parsed.data.cohortYear) : null,
        expiresInDays: parsed.data.expiresInDays ? Number(parsed.data.expiresInDays) : undefined,
        maxUses: parsed.data.maxUses ? Number(parsed.data.maxUses) : null,
      },
      actor.id,
      contextFromHeaders(await headers()),
    );
    revalidatePath("/admin/alumni/links");
    return { success: true, url: alumniSubmitUrl(token) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not create link" };
  }
}

const yearsSchema = z.object({ years: z.string().min(1) });

function parseYears(raw: string): number[] {
  const years = new Set<number>();
  for (const part of raw.split(",").map((p) => p.trim()).filter(Boolean)) {
    const rangeMatch = part.match(/^(\d{4})\s*-\s*(\d{4})$/);
    if (rangeMatch) {
      const [start, end] = [Number(rangeMatch[1]), Number(rangeMatch[2])];
      for (let y = Math.min(start, end); y <= Math.max(start, end); y++) years.add(y);
    } else if (/^\d{4}$/.test(part)) {
      years.add(Number(part));
    }
  }
  return Array.from(years).sort((a, b) => a - b);
}

export async function createCohortLinksAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireAlumniReview();
  const parsed = yearsSchema.safeParse({ years: formData.get("years") });
  if (!parsed.success) return { error: "Enter a year range or list, e.g. 2000-2005 or 2001,2003" };

  const years = parseYears(parsed.data.years);
  if (years.length === 0) return { error: "No valid years found" };
  if (years.length > 60) return { error: "Cannot create more than 60 links in one action" };

  try {
    const created = await createCohortLinks(db, years, actor.id, contextFromHeaders(await headers()));
    revalidatePath("/admin/alumni/links");
    return { success: true, links: created.map(({ label, year, url }) => ({ label, year, url })) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not create links" };
  }
}

export async function regenerateAlumniLinkAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAlumniReview();
  const id = String(formData.get("id") ?? "");
  try {
    const { token } = await regenerateAlumniLinkToken(db, id, actor.id, contextFromHeaders(await headers()));
    revalidatePath("/admin/alumni/links");
    return { success: true, url: alumniSubmitUrl(token) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not regenerate" };
  }
}

export async function setAlumniLinkActiveAction(formData: FormData): Promise<void> {
  const actor = await requireAlumniReview();
  const id = String(formData.get("id") ?? "");
  const isActive = formData.get("isActive") === "true";
  await setAlumniLinkActive(db, id, isActive, actor.id, contextFromHeaders(await headers()));
  revalidatePath("/admin/alumni/links");
}
