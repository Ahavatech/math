/**
 * The exact sentinel prisma/seed.ts writes into a field it has no real
 * content for yet. Shared so public pages can hide a field that still
 * holds it, without duplicating the string.
 */
export const PLACEHOLDER_PROSE =
  "Placeholder description. The department will provide final copy for this page.";

export function isPlaceholder(text: string): boolean {
  return text.trim() === PLACEHOLDER_PROSE;
}
