/**
 * Turns a database enum value such as "SPECIAL_LECTURE" into reader-facing
 * text ("Special lecture"). Used wherever an enum is shown to visitors.
 */
export function humanise(value: string): string {
  const text = value.replace(/_/g, " ").trim().toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}
