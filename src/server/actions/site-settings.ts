"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser, requirePermission } from "@/lib/rbac";
import { contextFromHeaders } from "@/server/services/audit";
import { sanitizeRichText } from "@/lib/sanitize-html";
import {
  setSetting,
  restoreSetting,
  listRevisions,
  type SettingsKey,
} from "@/server/services/site-settings";
import { revalidatePathsFor } from "@/server/services/site-settings";

export async function listSettingRevisionsAction(key: SettingsKey) {
  await requireSiteEdit();
  const revisions = await listRevisions(db, key);
  return revisions.map((r) => ({
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    createdByName: r.createdBy?.name ?? "Unknown",
    snapshot: r.snapshot,
  }));
}

type ActionResult = { error?: string; success?: boolean };

async function requireSiteEdit() {
  const user = await getCurrentUser();
  return requirePermission(user, "site.edit");
}

async function saveAndRevalidate(key: SettingsKey, value: unknown) {
  const actor = await requireSiteEdit();
  await setSetting(db, key, value, actor.id, contextFromHeaders(await headers()));
  for (const path of revalidatePathsFor(key)) {
    revalidatePath(path);
  }
}

function str(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "");
}

export async function saveIdentityAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await saveAndRevalidate("identity", {
      name: str(formData, "name"),
      tagline: str(formData, "tagline"),
      logoId: str(formData, "logoId") || null,
    });
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save" };
  }
}

export async function saveHodAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await saveAndRevalidate("hod.welcomeAddress", {
      name: str(formData, "name"),
      title: str(formData, "title"),
      photoId: str(formData, "photoId") || null,
      message: sanitizeRichText(str(formData, "message")),
    });
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save" };
  }
}

export async function saveHeroAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await saveAndRevalidate("homepage.hero", {
      heading: str(formData, "heading"),
      subheading: str(formData, "subheading"),
      imageId: str(formData, "imageId") || null,
      ctaLabel: str(formData, "ctaLabel"),
      ctaHref: str(formData, "ctaHref"),
    });
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save" };
  }
}

export async function saveAnnouncementAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await saveAndRevalidate("site.announcement", {
      enabled: formData.get("enabled") === "true",
      message: str(formData, "message"),
      href: str(formData, "href") || null,
    });
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save" };
  }
}

export async function saveStatsAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const stat = (name: string) => ({
      mode: str(formData, `${name}Mode`) === "manual" ? ("manual" as const) : ("auto" as const),
      manualValue:
        str(formData, `${name}Value`) === "" ? null : Number(str(formData, `${name}Value`)),
    });

    await saveAndRevalidate("homepage.stats", {
      staff: stat("staff"),
      alumni: stat("alumni"),
      programmes: stat("programmes"),
      researchAreas: stat("researchAreas"),
    });
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save" };
  }
}

export async function saveContactAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const phones = formData
      .getAll("phones")
      .map((p) => String(p))
      .filter(Boolean);
    const lat = str(formData, "mapLat");
    const lng = str(formData, "mapLng");

    await saveAndRevalidate("contact.details", {
      address: str(formData, "address"),
      phones,
      email: str(formData, "email"),
      officeHours: str(formData, "officeHours"),
      mapLat: lat === "" ? null : Number(lat),
      mapLng: lng === "" ? null : Number(lng),
    });
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save" };
  }
}

export async function saveSocialLinksAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const labels = formData.getAll("label").map(String);
    const urls = formData.getAll("url").map(String);
    const value: Record<string, string> = {};
    labels.forEach((label, i) => {
      if (label && urls[i]) value[label] = urls[i];
    });

    await saveAndRevalidate("social.links", value);
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save" };
  }
}

export async function saveFooterTextAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await saveAndRevalidate("footer.text", { text: str(formData, "text") });
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save" };
  }
}

export async function restoreSettingAction(formData: FormData): Promise<void> {
  const actor = await requireSiteEdit();
  const key = str(formData, "key") as SettingsKey;
  const revisionId = str(formData, "revisionId");

  await restoreSetting(db, key, revisionId, actor.id, contextFromHeaders(await headers()));
  for (const path of revalidatePathsFor(key)) {
    revalidatePath(path);
  }
  revalidatePath("/admin/site");
}
