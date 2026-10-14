import "server-only";
import type { PrismaClient } from "@prisma/client";
import { cloudinary } from "@/lib/cloudinary";
import { logAction, type AuditRequestContext } from "@/server/services/audit";

export const ARTICLE_PDF_FOLDER = "oau-maths/journal/articles";
// Google Scholar's own crawling guidance recommends under 5MB (searchable
// text, no Type 3 fonts), but that is indexing advice, not a hosting
// requirement - this app's own cap matches the existing downloads/CV
// Cloudinary pipeline ceiling, since academic PDFs with figures routinely
// exceed 5MB. See docs/JOURNAL.md.
export const MAX_ARTICLE_PDF_BYTES = 10 * 1024 * 1024; // 10MB

/** NFD-folds diacritics (e.g. "Ọlábísí" -> "Olabisi") before stripping, same technique as slugify.ts. */
function asciiFold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9-]/g, "");
}

function surnameFrom(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return asciiFold(parts[parts.length - 1] || "Article") || "Article";
}

/** Builds the clean, citation-friendly filename used for Content-Disposition. */
export function articlePdfFilename(firstAuthorName: string, year: number, title: string): string {
  const shortTitle = asciiFold(title.trim().split(/\s+/).slice(0, 5).join("-"));
  return `${surnameFrom(firstAuthorName)}-${year}-${shortTitle || "Article"}.pdf`;
}

/**
 * Registers a signed-uploaded article PDF as a Download (category "OTHER"
 * is not used here - journal PDFs are referenced only via Article.pdfDownloadId,
 * never listed on /students/downloads), reusing the same verification
 * pattern as lecturer-cv.ts and downloads.ts: re-fetch format/size from
 * Cloudinary rather than trust the client.
 */
export async function registerArticlePdf(
  db: PrismaClient,
  articleId: string,
  publicId: string,
  actorId: string,
  context?: AuditRequestContext,
) {
  const folderPrefix = `${ARTICLE_PDF_FOLDER}/`;
  if (!publicId.startsWith(folderPrefix)) {
    throw new Error(`publicId must be inside the ${folderPrefix} folder`);
  }

  const resource = await cloudinary.api.resource(publicId, { resource_type: "image" });
  if (resource.format !== "pdf") {
    await cloudinary.api.delete_resources([publicId], { resource_type: "image" });
    throw new Error(`The uploaded file is not a PDF (Cloudinary reports format "${resource.format}")`);
  }
  if (resource.bytes > MAX_ARTICLE_PDF_BYTES) {
    await cloudinary.api.delete_resources([publicId], { resource_type: "image" });
    throw new Error(`The file is too large (${Math.round(resource.bytes / 1024 / 1024)}MB); the maximum is 10MB`);
  }

  const article = await db.article.findUniqueOrThrow({ where: { id: articleId } });

  return db.$transaction(async (tx) => {
    const previousDownloadId = article.pdfDownloadId;

    const download = await tx.download.create({
      data: {
        title: `${article.title}.pdf`,
        category: "JOURNAL_ARTICLE",
        filePublicId: publicId,
        fileUrl: resource.secure_url,
        fileSize: resource.bytes,
        status: "DRAFT", // never listed on /students/downloads; the article's own PDF route streams it
        uploadedById: actorId,
      },
    });

    await tx.article.update({ where: { id: articleId }, data: { pdfDownloadId: download.id } });

    if (previousDownloadId) {
      const previous = await tx.download.findUnique({ where: { id: previousDownloadId } });
      if (previous?.filePublicId) {
        try {
          await cloudinary.api.delete_resources([previous.filePublicId], { resource_type: "image" });
        } catch {
          // best-effort cleanup
        }
      }
      await tx.download.delete({ where: { id: previousDownloadId } });
    }

    await logAction(
      tx,
      { actorId, action: "journal.article.pdf_upload", entityType: "Article", entityId: articleId, summary: `Uploaded PDF for "${article.title}"` },
      context,
    );

    return download;
  });
}
