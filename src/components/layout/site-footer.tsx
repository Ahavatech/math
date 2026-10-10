import Link from "next/link";
import type { NavLink, ContactDetails, SocialLinks } from "@/server/services/site-content";

export function SiteFooter({
  nav,
  contact,
  social,
  footerText,
}: {
  nav: NavLink[];
  contact: ContactDetails;
  social: SocialLinks;
  footerText: string | null;
}) {
  const year = new Date().getFullYear();
  const hasContact =
    contact.address || contact.phones.length > 0 || contact.email || contact.officeHours;
  const socialEntries = Object.entries(social);

  return (
    <footer className="border-t border-border bg-muted/40">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-4 lg:px-8">
        <div className="space-y-2 lg:col-span-1">
          <p className="font-heading text-sm font-semibold">Department of Mathematics</p>
          <p className="text-sm text-muted-foreground">Obafemi Awolowo University, Ile-Ife</p>
        </div>

        {nav.map((column) =>
          column.children.length > 0 ? (
            <div key={column.id}>
              <p className="font-heading text-sm font-semibold">{column.label}</p>
              <ul className="mt-3 space-y-2">
                {column.children.map((child) => (
                  <li key={child.id}>
                    <Link
                      href={child.href}
                      className="text-sm text-muted-foreground hover:text-foreground hover:underline"
                    >
                      {child.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div key={column.id}>
              <Link
                href={column.href}
                className="font-heading text-sm font-semibold hover:underline"
              >
                {column.label}
              </Link>
            </div>
          ),
        )}

        {hasContact ? (
          <div>
            <p className="font-heading text-sm font-semibold">Contact</p>
            <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
              {contact.address ? <li>{contact.address}</li> : null}
              {contact.phones.map((phone) => (
                <li key={phone}>{phone}</li>
              ))}
              {contact.email ? (
                <li>
                  <a href={`mailto:${contact.email}`} className="hover:text-foreground hover:underline">
                    {contact.email}
                  </a>
                </li>
              ) : null}
              {contact.officeHours ? <li>{contact.officeHours}</li> : null}
            </ul>
            {socialEntries.length > 0 ? (
              <ul className="mt-4 flex gap-3">
                {socialEntries.map(([label, url]) => (
                  <li key={label}>
                    <a
                      href={url}
                      className="text-sm text-muted-foreground hover:text-foreground hover:underline"
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="border-t border-border px-4 py-4 sm:px-6 lg:px-8">
        <p className="mx-auto max-w-6xl text-xs text-muted-foreground">
          {footerText ?? `© ${year} Department of Mathematics, Obafemi Awolowo University.`}
        </p>
      </div>
    </footer>
  );
}
