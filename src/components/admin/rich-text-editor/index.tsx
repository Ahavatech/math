"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Tiptap (and KaTeX's preview) is dynamically imported so it only ever
 * loads on the admin page that actually renders an editor, never as
 * part of a shared/public bundle. See scripts/check-bundle-leaks.ts.
 */
export const RichTextEditor = dynamic(
  () => import("./rich-text-editor").then((m) => m.RichTextEditor),
  { ssr: false, loading: () => <Skeleton className="h-40 w-full" /> },
);
