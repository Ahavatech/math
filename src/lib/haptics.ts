/**
 * Haptic feedback, where the device offers it. Phones that support the web
 * Vibration API (most Android browsers) get a short tick; anywhere else this
 * does nothing, and the visual success mark carries the message on its own.
 * It never throws and never runs on the server.
 */

type Pattern = number | number[];

function buzz(pattern: Pattern): void {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  // Respect a person who has asked for less motion.
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Some browsers refuse outside a user gesture; ignore.
  }
}

/** A saved change, a sent message: two quick ticks, like a confirmation. */
export function hapticSuccess(): void {
  buzz([12, 40, 18]);
}

/** A light tick for a toggle or a selection. */
export function hapticSelect(): void {
  buzz(8);
}

/** Something went wrong: one longer, firmer buzz. */
export function hapticError(): void {
  buzz([40, 30, 40]);
}
