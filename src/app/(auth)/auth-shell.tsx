import Link from "next/link";
import Image from "next/image";
import oauLogo from "../../../design-assets/oau-logo.png";

/**
 * The frame shared by every sign-in, reset and invite screen: the
 * department's mark, a serif title with the 2px ink rule used across the
 * site, one narrow column, and a way back to the public website.
 */
export function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="grid-paper flex min-h-screen items-start justify-center bg-background px-5 py-10 sm:items-center">
      <div className="w-full max-w-md bg-background p-6 sm:border sm:border-foreground sm:p-8">
        <Link href="/" className="flex items-center gap-3">
          <Image src={oauLogo} alt="" aria-hidden="true" className="h-10 w-auto" priority />
          <span className="font-heading text-base leading-tight font-semibold">
            Department of Mathematics
            <span className="block text-sm font-normal text-muted-foreground">Obafemi Awolowo University</span>
          </span>
        </Link>

        <h1 className="mt-8 border-b-2 border-foreground pb-3 font-heading text-3xl leading-tight font-semibold">
          {title}
        </h1>
        {description ? <p className="mt-3 text-muted-foreground">{description}</p> : null}

        <div className="mt-6">{children}</div>

        <p className="mt-8 border-t border-border pt-4 text-sm">
          <Link href="/" className="link-rule py-2 font-medium">
            Back to the website
          </Link>
        </p>
      </div>
    </main>
  );
}
