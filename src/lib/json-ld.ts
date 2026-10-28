/**
 * Serializes a JSON-LD object for embedding via dangerouslySetInnerHTML
 * in a <script type="application/ld+json"> tag. JSON.stringify alone
 * does not escape "<", so an admin-entered string field (e.g. a news
 * post or event title) containing "</script><script>..." could break
 * out of the tag and execute as a new <script> element. Escaping "<" to
 * its unicode escape neutralises that without changing the parsed JSON
 * value (JSON parsers treat < identically to a literal "<").
 */
export function safeJsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/** Build a CollegeOrUniversity / Organization JSON-LD for the department. */
export function buildOrganizationJsonLd(siteUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": ["CollegeOrUniversity", "Organization"],
    name: "Department of Mathematics, Obafemi Awolowo University",
    alternateName: "OAU Maths Department",
    url: siteUrl,
    parentOrganization: {
      "@type": "CollegeOrUniversity",
      name: "Obafemi Awolowo University",
      url: "https://oauife.edu.ng",
    },
    address: {
      "@type": "PostalAddress",
      addressLocality: "Ile-Ife",
      addressRegion: "Osun State",
      addressCountry: "NG",
    },
  };
}

/** Build a BreadcrumbList JSON-LD from an array of {name, url} items. */
export function buildBreadcrumbJsonLd(
  items: Array<{ name: string; url: string }>,
  siteUrl: string,
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: item.name,
      item: item.url.startsWith("http") ? item.url : `${siteUrl}${item.url}`,
    })),
  };
}
