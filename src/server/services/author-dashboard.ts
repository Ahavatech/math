import "server-only";
import type { ManuscriptStatus, PrismaClient } from "@prisma/client";

export function plainLanguageStatus(status: ManuscriptStatus): string {
  switch (status) {
    case "INCOMPLETE":
      return "Draft";
    case "SUBMITTED":
      return "Received";
    case "SCREENING":
      return "With the editor";
    case "RETURNED_TO_AUTHOR":
      return "Needs your attention";
    case "UNDER_REVIEW":
      return "In peer review";
    case "REJECTED":
      return "Not accepted";
    case "WITHDRAWN":
      return "Withdrawn";
    default:
      return String(status);
  }
}

export interface AuthorManuscriptSummary {
  id: string;
  reference: string | null;
  title: string;
  status: ManuscriptStatus;
  submittedById: string;
  createdAt: Date;
  submittedAt: Date | null;
  plainLanguageStatus: string;
}

export async function getAuthorManuscripts(
  db: PrismaClient,
  userId: string,
): Promise<AuthorManuscriptSummary[]> {
  const rows = await db.manuscript.findMany({
    where: { submittedById: userId },
    select: {
      id: true,
      reference: true,
      title: true,
      status: true,
      submittedById: true,
      createdAt: true,
      submittedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((r) => ({
    ...r,
    plainLanguageStatus: plainLanguageStatus(r.status),
  }));
}

export interface AuthorManuscriptDetail {
  id: string;
  reference: string | null;
  title: string;
  abstract: string;
  keywords: string[];
  status: ManuscriptStatus;
  createdAt: Date;
  submittedAt: Date | null;
  plainLanguageStatus: string;
  files: Array<{
    id: string;
    kind: string;
    originalName: string;
    size: number;
    createdAt: Date;
  }>;
  events: Array<{
    id: string;
    type: string;
    visibleToAuthor: boolean;
    note: string | null;
    createdAt: Date;
  }>;
  /** Rejection letter, if status is REJECTED and a letter exists */
  rejectionLetter: string | null;
}

export async function getAuthorManuscriptDetail(
  db: PrismaClient,
  userId: string,
  manuscriptId: string,
): Promise<AuthorManuscriptDetail> {
  const ms = await db.manuscript.findUnique({
    where: { id: manuscriptId },
    select: {
      id: true,
      reference: true,
      title: true,
      abstract: true,
      keywords: true,
      status: true,
      submittedById: true,
      createdAt: true,
      submittedAt: true,
      files: {
        select: { id: true, kind: true, originalName: true, size: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
      events: {
        where: { visibleToAuthor: true },
        select: { id: true, type: true, visibleToAuthor: true, note: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!ms || ms.submittedById !== userId) {
    throw new Error("Manuscript not found");
  }

  // Fetch rejection letter if applicable
  let rejectionLetter: string | null = null;
  if (ms.status === "REJECTED") {
    const decision = await db.editorialDecision.findFirst({
      where: { manuscriptId },
      orderBy: { createdAt: "desc" },
      select: { letter: true },
    });
    rejectionLetter = decision?.letter ?? null;
  }

  return {
    id: ms.id,
    reference: ms.reference,
    title: ms.title,
    abstract: ms.abstract,
    keywords: ms.keywords,
    status: ms.status,
    createdAt: ms.createdAt,
    submittedAt: ms.submittedAt,
    plainLanguageStatus: plainLanguageStatus(ms.status),
    files: ms.files,
    events: ms.events,
    rejectionLetter,
  };
}
