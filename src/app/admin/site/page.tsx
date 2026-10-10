import { redirect } from "next/navigation";
import { getCurrentUser, hasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { getSetting } from "@/server/services/site-settings";
import { IdentitySection } from "./sections/identity-section";
import { HodSection } from "./sections/hod-section";
import { HeroSection } from "./sections/hero-section";
import { AnnouncementSection } from "./sections/announcement-section";
import { StatsSection } from "./sections/stats-section";
import { ContactSection } from "./sections/contact-section";
import { SocialLinksSection } from "./sections/social-links-section";
import { FooterTextSection } from "./sections/footer-text-section";

export default async function AdminSitePage() {
  const user = await getCurrentUser();
  if (!user || !user.isActive || !hasPermission(user, "site.edit")) {
    redirect("/403");
  }

  const [identity, hod, hero, announcement, stats, contact, social, footer, media] =
    await Promise.all([
      getSetting(db, "identity"),
      getSetting(db, "hod.welcomeAddress"),
      getSetting(db, "homepage.hero"),
      getSetting(db, "site.announcement"),
      getSetting(db, "homepage.stats"),
      getSetting(db, "contact.details"),
      getSetting(db, "social.links"),
      getSetting(db, "footer.text"),
      db.mediaAsset.findMany({ orderBy: { createdAt: "desc" }, take: 24 }),
    ]);

  return (
    <div className="max-w-3xl space-y-10">
      <h1 className="text-lg font-semibold">Site content</h1>
      <IdentitySection value={identity} existingMedia={media} />
      <HodSection value={hod} existingMedia={media} />
      <HeroSection value={hero} existingMedia={media} />
      <AnnouncementSection value={announcement} />
      <StatsSection value={stats} />
      <ContactSection value={contact} />
      <SocialLinksSection value={social} />
      <FooterTextSection value={footer} />
    </div>
  );
}
