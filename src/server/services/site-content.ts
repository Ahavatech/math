import "server-only";
import { db } from "@/lib/db";
import { getSetting } from "@/server/services/site-settings";

export type NavLink = {
  id: string;
  label: string;
  href: string;
  children: { id: string; label: string; href: string }[];
};

async function getNavByLocation(location: "HEADER" | "FOOTER"): Promise<NavLink[]> {
  const items = await db.navItem.findMany({
    where: { location, isVisible: true },
    orderBy: { order: "asc" },
  });

  const byId = new Map(items.map((item) => [item.id, item]));
  const topLevel = items.filter((item) => !item.parentId || !byId.has(item.parentId));

  return topLevel.map((item) => ({
    id: item.id,
    label: item.label,
    href: item.href,
    children: items
      .filter((child) => child.parentId === item.id)
      .map((child) => ({ id: child.id, label: child.label, href: child.href })),
  }));
}

/** Falls back to an empty list when the database has no header nav yet. */
export async function getHeaderNav(): Promise<NavLink[]> {
  try {
    return await getNavByLocation("HEADER");
  } catch {
    return [];
  }
}

export async function getFooterNav(): Promise<NavLink[]> {
  try {
    return await getNavByLocation("FOOTER");
  } catch {
    return [];
  }
}

export type SiteAnnouncement = { enabled: boolean; message: string; href: string | null };
export type ContactDetails = {
  address: string;
  phones: string[];
  email: string;
  officeHours: string;
  mapLat: number | null;
  mapLng: number | null;
};
export type SocialLinks = Record<string, string>;

/**
 * These all read through the typed settings registry (site-settings.ts)
 * so there is exactly one source of truth for each key's shape; a
 * malformed or stale row falls back to that key's registry default
 * rather than ever reaching a public page as `undefined`.
 */
export async function getAnnouncement(): Promise<SiteAnnouncement | null> {
  try {
    const value = await getSetting(db, "site.announcement");
    if (!value.enabled || !value.message) return null;
    return value;
  } catch {
    return null;
  }
}

export async function getContactDetails(): Promise<ContactDetails> {
  try {
    return await getSetting(db, "contact.details");
  } catch {
    return { address: "", phones: [], email: "", officeHours: "", mapLat: null, mapLng: null };
  }
}

export async function getSocialLinks(): Promise<SocialLinks> {
  try {
    return await getSetting(db, "social.links");
  } catch {
    return {};
  }
}

export async function getFooterText(): Promise<string | null> {
  try {
    const value = await getSetting(db, "footer.text");
    return value.text || null;
  } catch {
    return null;
  }
}

export async function getIdentity() {
  try {
    return await getSetting(db, "identity");
  } catch {
    return { name: "Department of Mathematics", tagline: "", logoId: null };
  }
}

export async function getHodWelcome() {
  try {
    return await getSetting(db, "hod.welcomeAddress");
  } catch {
    return { name: "", title: "", photoId: null, message: "" };
  }
}

export async function getHomepageHero() {
  try {
    return await getSetting(db, "homepage.hero");
  } catch {
    return { heading: "", subheading: "", imageId: null, ctaLabel: "", ctaHref: "" };
  }
}
