"use client";

import { ErrorContent } from "@/components/layout/error-content";

// A failure inside a page: the site's header and footer are still there around it.
export default function ErrorPage(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorContent {...props} asMain={false} />;
}
