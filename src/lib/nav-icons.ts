import {
  BookOpen,
  BookText,
  CalendarDays,
  Circle,
  FlaskConical,
  GraduationCap,
  Handshake,
  House,
  Info,
  Mail,
  Newspaper,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * A symbol for a site section, chosen from its address so the menu stays
 * editable by the department: a renamed or re-ordered menu keeps its icons,
 * and an address nobody has mapped gets a plain dot rather than a wrong
 * symbol. Icons are drawn at the weight of the text beside them (see the
 * `svg.lucide` rules in globals.css).
 */
const BY_SECTION: Record<string, LucideIcon> = {
  "": House,
  about: Info,
  programmes: GraduationCap,
  research: FlaskConical,
  staff: Users,
  news: Newspaper,
  events: CalendarDays,
  alumni: Handshake,
  students: BookOpen,
  journal: BookText,
  contact: Mail,
};

export function iconForHref(href: string): LucideIcon {
  const section = href.split("?")[0].split("/").filter(Boolean)[0] ?? "";
  return BY_SECTION[section] ?? Circle;
}

/** Sections worth a tab, most useful first. */
export const TAB_PRIORITY = ["/students", "/news", "/events", "/staff", "/programmes", "/research", "/about"];

/** A short tab label: the whole label if it fits, else its first word. */
export function tabLabel(label: string): string {
  return label.length <= 10 ? label : label.split(/\s+/)[0];
}
