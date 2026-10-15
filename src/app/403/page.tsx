import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 p-4 text-center">
      <h1 className="text-2xl font-semibold">403 — Not authorised</h1>
      <p className="text-muted-foreground text-sm">
        You do not have permission to view this page.
      </p>
      <Link href="/admin" className="text-sm underline">
        Back to admin
      </Link>
    </div>
  );
}
