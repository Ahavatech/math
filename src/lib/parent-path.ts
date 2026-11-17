/**
 * Where "Back" should lead from a public page: the section the page belongs
 * to. Only addresses known to be real pages are returned, so Back never lands
 * on a 404. The home page has no parent.
 */
const SECOND_LEVEL: Record<string, string[]> = {
  students: ["courses", "handbook", "calendar", "downloads"],
};

// A page type whose own address has no list page at that path.
const REDIRECT_SECTION: Record<string, string> = {
  lecturer: "/staff",
};

export function parentPath(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;
  const [first, second] = segments;

  if (REDIRECT_SECTION[first]) return segments.length === 1 ? "/" : REDIRECT_SECTION[first];

  if (segments.length === 1) return "/";
  if (segments.length >= 3 && SECOND_LEVEL[first]?.includes(second)) return `/${first}/${second}`;
  return `/${first}`;
}
