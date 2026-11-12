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
    <footer data-site-footer className="mt-16 border-t-2 border-foreground bg-background">
      <div className="mx-auto grid max-w-7xl gap-10 px-(--gutter) py-12 lg:grid-cols-[1.2fr_2fr_1.2fr]">
        <div>
          <p className="font-heading text-xl font-semibold">Department of Mathematics</p>
          <p className="mt-1 text-muted-foreground">Obafemi Awolowo University, Ile-Ife</p>
        </div>

        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3">
          {nav.map((column) => (
            <div key={column.id}>
              <Link
                href={column.href}
                className="link-rule inline-block font-heading text-base font-semibold"
              >
                {column.label}
              </Link>
              {column.children.length > 0 ? (
                <ul className="mt-2">
                  {column.children.map((child) => (
                    <li key={child.id}>
                      <Link
                        href={child.href}
                        className="inline-flex min-h-9 items-center text-[0.9375rem] text-muted-foreground hover:text-accent"
                      >
                        {child.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </nav>

        {hasContact ? (
          <div>
            <p className="font-heading text-base font-semibold">Contact</p>
            <ul className="mt-2 space-y-1.5 text-[0.9375rem] text-muted-foreground">
              {contact.address ? <li>{contact.address}</li> : null}
              {contact.phones.map((phone) => (
                <li key={phone}>{phone}</li>
              ))}
              {contact.email ? (
                <li>
                  <a href={`mailto:${contact.email}`} className="link-rule text-foreground">
                    {contact.email}
                  </a>
                </li>
              ) : null}
              {contact.officeHours ? <li>{contact.officeHours}</li> : null}
            </ul>
            {socialEntries.length > 0 ? (
              <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1">
                {socialEntries.map(([label, url]) => (
                  <li key={label}>
                    <a href={url} className="link-rule inline-block py-1.5 text-[0.9375rem]">
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="border-t border-border py-4">
        <p className="mx-auto max-w-7xl px-(--gutter) text-sm text-muted-foreground">
          {footerText ?? `© ${year} Department of Mathematics, Obafemi Awolowo University.`}
        </p>
      </div>
    </footer>
  );
}
