import "server-only";
import { db } from "@/lib/db";

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

export type SiteAnnouncement = { enabled: boolean; message: string };
export type ContactDetails = {
  address?: string;
  phone?: string;
  email?: string;
  officeHours?: string;
};
export type SocialLinks = Record<string, string>;

async function getSetting<T>(key: string): Promise<T | null> {
  try {
    const row = await db.siteSetting.findUnique({ where: { key } });
    return (row?.value as T) ?? null;
  } catch {
    return null;
  }
}

export async function getAnnouncement(): Promise<SiteAnnouncement | null> {
  const value = await getSetting<SiteAnnouncement>("site.announcement");
  if (!value?.enabled || !value.message) return null;
  return value;
}

export async function getContactDetails(): Promise<ContactDetails> {
  return (await getSetting<ContactDetails>("contact.details")) ?? {};
}

export async function getSocialLinks(): Promise<SocialLinks> {
  return (await getSetting<SocialLinks>("social.links")) ?? {};
}

export async function getFooterText(): Promise<string | null> {
  const value = await getSetting<{ text?: string }>("footer.text");
  return value?.text ?? null;
}
