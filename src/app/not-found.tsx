import Link from "next/link";

export const metadata = { title: "Page not found" };

const WHERE_TO_GO = [
  { href: "/students/courses", label: "Courses" },
  { href: "/staff", label: "Staff" },
  { href: "/news", label: "News" },
  { href: "/events", label: "Events" },
  { href: "/journal", label: "Journal" },
  { href: "/contact", label: "Contact" },
];

export default function NotFoundPage() {
  return (
    <main className="grid-paper flex min-h-screen items-start justify-center bg-background px-5 py-16 sm:items-center">
      <div className="w-full max-w-lg bg-background p-6 sm:border sm:border-foreground sm:p-8">
        <p className="font-heading text-6xl font-semibold text-accent">404</p>
        <h1 className="mt-2 border-b-2 border-foreground pb-3 font-heading text-3xl leading-tight font-semibold">
          Page not found
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          The page you are looking for does not exist, or has moved. Try one of these instead.
        </p>
        <ul className="mt-4 grid grid-cols-2 gap-x-6 border-b border-border sm:grid-cols-3">
          {WHERE_TO_GO.map((item) => (
            <li key={item.href} className="border-t border-border">
              <Link href={item.href} className="flex min-h-12 items-center font-medium hover:text-accent">
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
        <form action="/search" method="get" role="search" className="mt-6 flex">
          <label htmlFor="not-found-search" className="sr-only">
            Search the site
          </label>
          <input
            id="not-found-search"
            name="q"
            type="search"
            minLength={2}
            placeholder="Search the site"
            className="h-12 min-w-0 flex-1 border border-input bg-background px-3 text-base"
          />
          <button
            type="submit"
            className="h-12 bg-primary px-5 text-base font-medium text-primary-foreground transition-colors hover:bg-foreground"
          >
            Search
          </button>
        </form>
        <p className="mt-6 border-t border-border pt-4">
          <Link href="/" className="link-rule py-2 font-medium">
            Back to the home page
          </Link>
        </p>
      </div>
    </main>
  );
}
