"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { hapticSelect } from "@/lib/haptics";
import { THEME_STORAGE_KEY, isTheme, type Theme } from "@/lib/theme";

const CHANGE_EVENT = "oau-theme-change";

const OPTIONS: Array<{ value: Theme; label: string; icon: LucideIcon }> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

function read(): Theme {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

function apply(theme: Theme) {
  if (theme === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", theme);
  try {
    if (theme === "system") window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage can be blocked; the choice then lasts until the page closes.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/**
 * A three-way choice: Light, Dark, or follow the device. It is a segmented
 * control (one group, one choice), so a screen reader hears "Appearance, Dark,
 * selected" and the whole group is one tab stop with arrow keys.
 *
 * `onChrome` is for placing it on the dark admin sidebar, where the text colours
 * come from the chrome tokens instead of the page tokens.
 */
export function ThemeToggle({ className = "", onChrome = false }: { className?: string; onChrome?: boolean }) {
  const theme = useSyncExternalStore(subscribe, read, () => "system" as Theme);

  const ink = onChrome ? "text-chrome-foreground" : "text-foreground";
  const border = onChrome ? "border-chrome-foreground/40" : "border-foreground/40";
  const selected = onChrome
    ? "bg-chrome-foreground text-chrome"
    : "bg-foreground text-background";

  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = OPTIONS[(index + step + OPTIONS.length) % OPTIONS.length];
    apply(next.value);
    hapticSelect();
    (event.currentTarget.parentElement?.querySelector(`[data-theme-option="${next.value}"]`) as HTMLElement | null)?.focus();
  }

  return (
    <div role="radiogroup" aria-label="Appearance" className={`inline-flex border ${border} ${ink} ${className}`}>
      {OPTIONS.map(({ value, label, icon: Icon }, index) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            data-theme-option={value}
            onKeyDown={(event) => onKeyDown(event, index)}
            onClick={() => {
              apply(value);
              hapticSelect();
            }}
            className={`inline-flex min-h-11 items-center gap-1.5 px-3 text-[0.9375rem] font-medium transition-colors ${
              active ? selected : onChrome ? "hover:bg-chrome-foreground/10" : "hover:bg-foreground/10"
            }`}
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
