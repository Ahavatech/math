import { z } from "zod";

export const inviteReviewerSchema = z.object({
  manuscriptId: z.string().min(1),
  roundId: z.string().min(1),
  reviewerUserId: z.string().min(1),
});

export const submitReviewSchema = z.object({
  assignmentId: z.string().min(1),
  recommendation: z.enum(["ACCEPT", "MINOR_REVISION", "MAJOR_REVISION", "REJECT"]),
  commentsToAuthor: z.string().min(1, "Comments to author are required"),
  commentsToEditor: z.string().optional(),
});

export const saveDraftReviewSchema = z.object({
  assignmentId: z.string().min(1),
  recommendation: z.enum(["ACCEPT", "MINOR_REVISION", "MAJOR_REVISION", "REJECT"]).optional(),
  commentsToAuthor: z.string().optional(),
  commentsToEditor: z.string().optional(),
});

export const recordDecisionSchema = z.object({
  manuscriptId: z.string().min(1),
  decision: z.enum(["ACCEPT", "MINOR_REVISION", "MAJOR_REVISION", "REJECT", "DESK_REJECT"]),
  letterHtml: z.string().min(1, "Decision letter is required"),
  allowOverride: z.boolean().optional(),
  overrideReason: z.string().optional(),
});

export type InviteReviewerInput = z.infer<typeof inviteReviewerSchema>;
export type SubmitReviewInput = z.infer<typeof submitReviewSchema>;
export type SaveDraftReviewInput = z.infer<typeof saveDraftReviewSchema>;
export type RecordDecisionInput = z.infer<typeof recordDecisionSchema>;
