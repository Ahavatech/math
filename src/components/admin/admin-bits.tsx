import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/** The way back from an edit page to its list. */
export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="link-rule mb-4 inline-flex items-center gap-1.5 py-2 font-medium">
      <ArrowLeft className="size-4" aria-hidden="true" />
      {children}
    </Link>
  );
}

/**
 * An empty list that says what is missing, why it matters and what to do,
 * instead of a bare "None yet".
 */
export function AdminEmpty({
  title,
  children,
  action,
}: {
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="border-t-2 border-foreground py-8">
      <p className="font-heading text-xl font-semibold">{title}</p>
      {children ? <p className="mt-2 max-w-prose text-muted-foreground">{children}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/** A titled group of fields inside a long form. */
export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 border-t border-border pt-6 first:border-t-0 first:pt-0">
      <div>
        <h2 className="font-heading text-lg font-semibold">{title}</h2>
        {description ? <p className="mt-1 text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
