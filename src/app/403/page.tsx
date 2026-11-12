import Link from "next/link";

export const metadata = { title: "Not authorised", robots: { index: false, follow: false } };

export default function ForbiddenPage() {
  return (
    <main className="grid-paper flex min-h-screen items-start justify-center bg-background px-5 py-16 sm:items-center">
      <div className="w-full max-w-md bg-background p-6 sm:border sm:border-foreground sm:p-8">
        <p className="font-heading text-6xl font-semibold text-accent">403</p>
        <h1 className="mt-2 border-b-2 border-foreground pb-3 font-heading text-3xl leading-tight font-semibold">
          Not authorised
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          You do not have permission to view this page. If you think you should, ask the department&apos;s
          administrator to check your role.
        </p>
        <p className="mt-6 flex flex-wrap gap-x-6 gap-y-1">
          <Link href="/admin" className="link-rule py-2 font-medium">
            Back to admin
          </Link>
          <Link href="/" className="link-rule py-2 font-medium">
            Go to the website
          </Link>
        </p>
      </div>
    </main>
  );
}
