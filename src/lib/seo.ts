import type { Metadata } from "next";
import { env } from "./env";

const SITE_NAME = "Department of Mathematics, OAU";
const TITLE_TEMPLATE = `%s | ${SITE_NAME}`;
const FALLBACK_OG_IMAGE = "/og-default.png";

export const SITE_URL = env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export interface PageMetadataOptions {
  title: string;
  description: string;
  /** Relative path, e.g. "/about" */
  path?: string;
  ogImage?: string;
  /** Prevents search engine indexing when true */
  noindex?: boolean;
}

/**
 * Shared metadata builder for all public pages.
 * Produces consistent title template, canonical URL, Open Graph and
 * Twitter card with a fallback image.
 */
export function buildPageMetadata(options: PageMetadataOptions): Metadata {
  const { title, description, path, ogImage, noindex } = options;
  const canonical = path ? `${SITE_URL}${path}` : undefined;
  const image = ogImage ?? FALLBACK_OG_IMAGE;

  return {
    title: { template: TITLE_TEMPLATE, default: title },
    description,
    ...(canonical ? { alternates: { canonical } } : {}),
    openGraph: {
      title: `${title} | ${SITE_NAME}`,
      description,
      ...(canonical ? { url: canonical } : {}),
      siteName: SITE_NAME,
      images: [{ url: image }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${SITE_NAME}`,
      description,
      images: [image],
    },
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
  };
}
