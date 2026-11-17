/**
 * Haptic feedback, where the device offers it. It never throws and never runs
 * on the server.
 *
 * - Browsers with the Vibration API (most Android browsers) get a short pattern.
 * - iPhone Safari has no Vibration API, but from iOS 17.4 a native switch
 *   (`<input type="checkbox" switch>`) ticks when it is toggled by a tap. We
 *   keep one hidden switch and toggle it through its label. iOS only allows
 *   this during a user gesture, so it works for taps and selections and may
 *   be silent for a tick that arrives after a network wait (a save finishing).
 * - Anywhere else nothing happens, and the visual success mark carries the
 *   message on its own.
 */

type Pattern = number | number[];

let iosSwitchLabel: HTMLLabelElement | null = null;

function iosTick(): void {
  if (typeof document === "undefined" || !document.body) return;
  if (!iosSwitchLabel) {
    const id = "haptic-switch";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.id = id;
    input.setAttribute("switch", "");
    input.tabIndex = -1;
    const label = document.createElement("label");
    label.htmlFor = id;
    label.setAttribute("aria-hidden", "true");
    // Present but invisible and untouchable; not display:none, which would stop it ticking.
    label.style.cssText =
      "position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden";
    input.style.cssText = "position:absolute;opacity:0;pointer-events:none";
    label.appendChild(input);
    document.body.appendChild(label);
    iosSwitchLabel = label;
  }
  iosSwitchLabel.click();
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

function buzz(pattern: Pattern, ticks: number): void {
  if (typeof navigator === "undefined" || prefersReducedMotion()) return;
  try {
    if (typeof navigator.vibrate === "function") {
      navigator.vibrate(pattern);
      return;
    }
    // No Vibration API: try the iOS switch, once per tick.
    for (let i = 0; i < ticks; i++) {
      window.setTimeout(iosTick, i * 70);
    }
  } catch {
    // Some browsers refuse outside a user gesture; ignore.
  }
}

/** A saved change, a sent message: two quick ticks, like a confirmation. */
export function hapticSuccess(): void {
  buzz([12, 40, 18], 2);
}

/** A light tick for a toggle or a selection. */
export function hapticSelect(): void {
  buzz(8, 1);
}

/** Something went wrong: one longer, firmer buzz (three ticks on iPhone). */
export function hapticError(): void {
  buzz([40, 30, 40], 3);
}
