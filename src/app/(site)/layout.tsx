import type { ReactNode } from "react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { AnnouncementBar } from "@/components/layout/announcement-bar";
import {
  getHeaderNav,
  getFooterNav,
  getAnnouncement,
  getContactDetails,
  getSocialLinks,
  getFooterText,
} from "@/server/services/site-content";

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const [headerNav, footerNav, announcement, contact, social, footerText] = await Promise.all([
    getHeaderNav(),
    getFooterNav(),
    getAnnouncement(),
    getContactDetails(),
    getSocialLinks(),
    getFooterText(),
  ]);

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Skip to content
      </a>
      {announcement ? <AnnouncementBar message={announcement.message} /> : null}
      <SiteHeader nav={headerNav} />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <SiteFooter nav={footerNav} contact={contact} social={social} footerText={footerText} />
    </>
  );
}
