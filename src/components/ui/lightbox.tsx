"use client";

import { useEffect, useRef, useState } from "react";

export type LightboxImage = {
  url: string;
  alt: string;
  caption?: string;
};

/**
 * A full-screen image viewer built on the native <dialog> element.
 * showModal() gives us, for free, from the platform rather than from
 * code we have to get right ourselves: a top-layer stacking context,
 * Escape-to-close, a focus trap, and focus restoration to whatever
 * triggered it on close. Clicking the backdrop (outside the image)
 * also closes it. Double-click/double-tap toggles a simple zoom, since
 * full pinch-gesture tracking is out of scope for a flyer viewer.
 */
export function Lightbox({ image, onClose }: { image: LightboxImage; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    function handleClose() {
      onClose();
    }
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleBackdropClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === dialogRef.current) {
      dialogRef.current?.close();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      className="m-auto max-h-none max-w-none border-none bg-transparent p-0 backdrop:bg-black/90"
    >
      <div className="flex max-h-screen w-screen flex-col items-center justify-center gap-2 p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.url}
          alt={image.alt}
          onDoubleClick={() => setZoomed((z) => !z)}
          className="max-h-[80vh] max-w-full cursor-zoom-in touch-pinch-zoom select-none object-contain transition-transform"
          style={{ transform: zoomed ? "scale(2)" : "scale(1)" }}
        />
        {image.caption ? <p className="max-w-2xl text-center text-sm text-white">{image.caption}</p> : null}
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          className="absolute right-4 top-4 rounded-full bg-white/10 px-3 py-1 text-sm text-white hover:bg-white/20"
          aria-label="Close"
        >
          Close
        </button>
      </div>
    </dialog>
  );
}
