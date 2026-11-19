"use client";

import "./globals.css";
import { ErrorContent } from "@/components/layout/error-content";

// A failure in the root layout itself: there is nothing around it, so it supplies the document.
export default function GlobalError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <ErrorContent {...props} asMain />
      </body>
    </html>
  );
}
