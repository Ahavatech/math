"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser, requirePermission } from "@/lib/rbac";
import { logAction, contextFromHeaders } from "@/server/services/audit";
import { sanitizeRichText } from "@/lib/sanitize-html";
import { getSetting, setSetting } from "@/server/services/site-settings";

type ActionResult = { error?: string; success?: boolean };

const saveSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  body: z.string(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
});

export async function savePageAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  const actor = requirePermission(user, "site.edit");

  const parsed = saveSchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title"),
    body: formData.get("body"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const sanitizedBody = sanitizeRichText(parsed.data.body);

  await db.$transaction(async (tx) => {
    const page = await tx.page.update({
      where: { id: parsed.data.id },
      data: { title: parsed.data.title, body: sanitizedBody, status: parsed.data.status },
    });

    await tx.contentRevision.create({
      data: {
        entityType: "Page",
        entityId: page.id,
        snapshot: { title: page.title, body: page.body, status: page.status },
        createdById: actor.id,
      },
    });

    await logAction(
      tx,
      {
        actorId: actor.id,
        action: "page.save",
        entityType: "Page",
        entityId: page.id,
        summary: `Saved page "${page.title}"`,
      },
      contextFromHeaders(await headers()),
    );
  });

  // Editing a page IS the HOD review this flag exists to prompt - clear it.
  const flags = await getSetting(db, "pages.importFlags");
  const page = await db.page.findUnique({ where: { id: parsed.data.id }, select: { slug: true } });
  if (page && flags[page.slug]) {
    const { [page.slug]: _removed, ...rest } = flags;
    await setSetting(db, "pages.importFlags", rest, actor.id);
  }

  revalidatePath("/admin/pages");
  revalidatePath(`/${parsed.data.id}`);
  revalidatePath("/about");
  return { success: true };
}
