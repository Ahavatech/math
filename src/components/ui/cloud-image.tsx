"use client";

import Image, { type ImageProps } from "next/image";

/**
 * next.config.ts restricts next/image's remotePatterns to
 * res.cloudinary.com only, so no other remote host can be loaded here.
 */
function cloudinaryLoader({ src, width, quality }: { src: string; width: number; quality?: number }) {
  // src is already a full Cloudinary delivery URL (MediaAsset.url); we
  // only need to inject the f_auto,q_auto,w_<width> transformation
  // segment right after "/upload/".
  const params = [`f_auto`, `q_${quality ?? "auto"}`, `w_${width}`].join(",");
  return src.replace("/upload/", `/upload/${params}/`);
}

export type CloudImageProps = Omit<ImageProps, "loader" | "alt"> & {
  /** Always required - CLAUDE.md: alt text is mandatory for any attached image. */
  alt: string;
};

export function CloudImage({ alt, ...props }: CloudImageProps) {
  return <Image loader={cloudinaryLoader} alt={alt} {...props} />;
}
