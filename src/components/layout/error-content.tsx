"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * What a visitor sees when something breaks on our side. It says so plainly,
 * offers a retry and a way home, and gives a short reference they can quote.
 * Nothing about the fault itself (no message, no stack) is shown.
 */
export function ErrorContent({
  error,
  reset,
  asMain,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  asMain: boolean;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const Wrapper = asMain ? "main" : "div";
  return (
    <Wrapper className="grid-paper flex min-h-[70vh] items-start justify-center bg-background px-5 py-16 sm:items-center">
      <div className="w-full max-w-lg bg-background p-6 sm:border sm:border-foreground sm:p-8">
        <p className="font-heading text-6xl font-semibold text-accent">Oops</p>
        <h1 className="mt-2 border-b-2 border-foreground pb-3 font-heading text-3xl leading-tight font-semibold">
          Something went wrong
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          This page could not be shown. The fault is on our side, not something you did. Please try again, or go back
          to the home page.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={reset}
            className="h-12 bg-primary px-6 text-base font-medium text-primary-foreground transition-colors hover:bg-foreground"
          >
            Try again
          </button>
          <Link href="/" className="link-rule inline-flex min-h-11 items-center font-medium">
            Back to the home page
          </Link>
        </div>
        <p className="mt-6 border-t border-border pt-4 text-muted-foreground">
          If it keeps happening, tell us through the{" "}
          <Link href="/contact" className="link-rule font-medium text-foreground">
            contact page
          </Link>
          {error.digest ? (
            <>
              {" "}
              and quote this reference: <span className="tabular font-mono text-foreground">{error.digest}</span>
            </>
          ) : null}
          .
        </p>
      </div>
    </Wrapper>
  );
}
