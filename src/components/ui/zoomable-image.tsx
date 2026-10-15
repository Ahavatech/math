"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { CloudImage } from "@/components/ui/cloud-image";

const Lightbox = dynamic(() => import("./lightbox").then((m) => m.Lightbox), { ssr: false });

/**
 * A thumbnail that opens its full image in a full-screen Lightbox on
 * click. The Lightbox component (and its code) is only ever fetched
 * when a visitor actually clicks an image, via next/dynamic - a page
 * with no zoomable images never downloads this code at all, which is
 * what keeps it out of every public page's default bundle.
 */
export function ZoomableImage({
  src,
  alt,
  caption,
  width,
  height,
  className,
  priority,
}: {
  src: string;
  alt: string;
  caption?: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`block w-full cursor-zoom-in ${width && height ? "" : "relative h-full"} ${className ?? ""}`}
      >
        {width && height ? (
          <CloudImage src={src} alt={alt} width={width} height={height} priority={priority} className="h-full w-full object-cover" />
        ) : (
          <CloudImage src={src} alt={alt} fill priority={priority} className="object-cover" />
        )}
      </button>
      {open ? <Lightbox image={{ url: src, alt, caption }} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
