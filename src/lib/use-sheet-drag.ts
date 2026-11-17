"use client";

import { useRef } from "react";

/**
 * Pull-down-to-dismiss for a bottom sheet. Spread the returned handlers on
 * the grab handle (and any header zone): the sheet follows the finger, and
 * letting go past a distance or with a quick flick dismisses it; otherwise it
 * springs back. Only vertical movement downward is tracked.
 */
export function useSheetDrag(getSheet: () => HTMLElement | null, dismiss: () => void) {
  const start = useRef<{ y: number; t: number; id: number } | null>(null);

  function offset(clientY: number) {
    return Math.max(0, clientY - (start.current?.y ?? clientY));
  }

  return {
    onPointerDown(event: React.PointerEvent<HTMLElement>) {
      start.current = { y: event.clientY, t: event.timeStamp, id: event.pointerId };
      event.currentTarget.setPointerCapture(event.pointerId);
      const sheet = getSheet();
      if (sheet) sheet.style.transition = "none";
    },
    onPointerMove(event: React.PointerEvent<HTMLElement>) {
      if (!start.current) return;
      const sheet = getSheet();
      if (sheet) sheet.style.transform = `translateY(${offset(event.clientY)}px)`;
    },
    onPointerUp(event: React.PointerEvent<HTMLElement>) {
      if (!start.current) return;
      const distance = offset(event.clientY);
      const elapsed = Math.max(1, event.timeStamp - start.current.t);
      const velocity = distance / elapsed; // px per ms
      start.current = null;
      const sheet = getSheet();
      if (distance > 96 || (distance > 24 && velocity > 0.6)) {
        dismiss();
        // Clear the inline offset once it has closed so a reopen starts fresh.
        window.setTimeout(() => {
          if (sheet) {
            sheet.style.transform = "";
            sheet.style.transition = "";
          }
        }, 300);
      } else if (sheet) {
        sheet.style.transition = "transform 220ms cubic-bezier(0.16, 1, 0.3, 1)";
        sheet.style.transform = "";
      }
    },
    onPointerCancel() {
      start.current = null;
      const sheet = getSheet();
      if (sheet) {
        sheet.style.transition = "transform 220ms cubic-bezier(0.16, 1, 0.3, 1)";
        sheet.style.transform = "";
      }
    },
  };
}
