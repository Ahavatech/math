import {
  BookOpen,
  CalendarDays,
  Circle,
  Globe,
  GraduationCap,
  Handshake,
  LayoutDashboard,
  Mail,
  Newspaper,
  Users,
  type LucideIcon,
} from "lucide-react";

/** Symbols for admin pages, by address. Unmapped pages get a plain dot. */
const BY_HREF: Record<string, LucideIcon> = {
  "/admin": LayoutDashboard,
  "/admin/news": Newspaper,
  "/admin/events": CalendarDays,
  "/admin/messages": Mail,
  "/admin/lecturers": Users,
  "/admin/alumni": Handshake,
  "/admin/courses": GraduationCap,
  "/admin/journal/manuscripts": BookOpen,
  "/admin/site": Globe,
};

export function adminIconForHref(href: string): LucideIcon {
  return BY_HREF[href] ?? Circle;
}

/** Pages worth a tab, most used first; only those the person may open appear. */
export const ADMIN_TAB_PRIORITY = [
  "/admin/news",
  "/admin/events",
  "/admin/messages",
  "/admin/lecturers",
  "/admin/alumni",
  "/admin/journal/manuscripts",
  "/admin/site",
];
