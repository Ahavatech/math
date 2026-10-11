/**
 * Deterministic "automatic" featured-lecturer pick: the same calendar day
 * (UTC) always picks the same lecturer from a given eligible list, and the
 * pick only changes when the day or the eligible list changes - no random
 * state, nothing to store.
 */
export function pickAutomaticFeatured<T extends { id: string }>(
  eligible: T[],
  date: Date = new Date(),
): T | null {
  if (eligible.length === 0) return null;

  const dayNumber = Math.floor(date.getTime() / 86_400_000);
  const index = dayNumber % eligible.length;
  return eligible[index];
}
