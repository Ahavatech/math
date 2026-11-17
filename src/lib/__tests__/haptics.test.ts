// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hapticError, hapticSelect, hapticSuccess } from "../haptics";

describe("haptics", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.matchMedia = ((query: string) => ({ matches: false, media: query })) as unknown as typeof window.matchMedia;
  });

  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(navigator, "vibrate");
    document.body.innerHTML = "";
  });

  it("uses the Vibration API where there is one", () => {
    const vibrate = vi.fn();
    Object.defineProperty(navigator, "vibrate", { value: vibrate, configurable: true });
    hapticSuccess();
    hapticSelect();
    hapticError();
    expect(vibrate).toHaveBeenCalledWith([12, 40, 18]);
    expect(vibrate).toHaveBeenCalledWith(8);
    expect(vibrate).toHaveBeenCalledWith([40, 30, 40]);
  });

  it("falls back to ticking a hidden native switch where there is no Vibration API (iPhone)", () => {
    const clicks: number[] = [];
    hapticSuccess();
    // The hidden switch is created on the first tick.
    vi.advanceTimersByTime(0);
    const label = document.querySelector("label[for=haptic-switch]") as HTMLLabelElement;
    expect(label).not.toBeNull();
    const input = label.querySelector("input")!;
    expect(input.getAttribute("switch")).toBe("");
    expect(label.getAttribute("aria-hidden")).toBe("true");
    input.addEventListener("click", () => clicks.push(Date.now()));
    vi.advanceTimersByTime(200);
    // Two ticks for a success (one already happened before we listened).
    expect(clicks.length).toBeGreaterThanOrEqual(1);
  });

  it("stays silent when the person prefers reduced motion", () => {
    window.matchMedia = ((query: string) => ({ matches: true, media: query })) as unknown as typeof window.matchMedia;
    const vibrate = vi.fn();
    Object.defineProperty(navigator, "vibrate", { value: vibrate, configurable: true });
    hapticSuccess();
    vi.advanceTimersByTime(500);
    expect(vibrate).not.toHaveBeenCalled();
    expect(document.querySelector("label[for=haptic-switch]")).toBeNull();
  });
});
