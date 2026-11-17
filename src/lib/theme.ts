/**
 * Light, dark, or follow the device. The choice is kept in this browser
 * (localStorage) and applied as `data-theme` on <html> before the page paints,
 * so there is no flash of the wrong scheme. "system" removes the attribute and
 * lets `prefers-color-scheme` decide.
 */
export const THEME_STORAGE_KEY = "oau-theme";

export const THEMES = ["light", "dark", "system"] as const;
export type Theme = (typeof THEMES)[number];

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

/** Runs inline in <head>, before first paint. Must stay tiny and dependency-free. */
export const themeInitScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t)}}catch(e){}})();`;
