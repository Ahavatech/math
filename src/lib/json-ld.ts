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

/** Build a Person JSON-LD for a lecturer profile page. */
export function buildPersonJsonLd(opts: {
  name: string;
  slug: string;
  honorific?: string | null;
  rank?: string | null;
  bio?: string | null;
  photoUrl?: string | null;
  email?: string | null;
  orcid?: string | null;
  siteUrl: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: opts.name,
    honorificPrefix: opts.honorific ?? undefined,
    jobTitle: opts.rank ?? undefined,
    description: opts.bio ?? undefined,
    image: opts.photoUrl ?? undefined,
    email: opts.email ?? undefined,
    sameAs: opts.orcid ? [`https://orcid.org/${opts.orcid}`] : undefined,
    url: `${opts.siteUrl}/lecturer/${opts.slug}`,
    worksFor: {
      "@type": "CollegeOrUniversity",
      name: "Department of Mathematics, Obafemi Awolowo University",
    },
  };
}

/** Build an Event JSON-LD for an event page. */
export function buildEventJsonLd(opts: {
  title: string;
  slug: string;
  description?: string | null;
  startsAt: Date;
  endsAt?: Date | null;
  venue?: string | null;
  speakerName?: string | null;
  flyerUrl?: string | null;
  siteUrl: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: opts.title,
    description: opts.description ?? undefined,
    startDate: opts.startsAt.toISOString(),
    endDate: opts.endsAt?.toISOString() ?? undefined,
    location: opts.venue
      ? { "@type": "Place", name: opts.venue }
      : { "@type": "Place", name: "OAU Mathematics Department" },
    organizer: {
      "@type": "CollegeOrUniversity",
      name: "Department of Mathematics, Obafemi Awolowo University",
      url: opts.siteUrl,
    },
    performer: opts.speakerName
      ? { "@type": "Person", name: opts.speakerName }
      : undefined,
    image: opts.flyerUrl ?? undefined,
    url: `${opts.siteUrl}/events/${opts.slug}`,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
  };
}

/** Build a NewsArticle JSON-LD for a news post page. */
export function buildNewsArticleJsonLd(opts: {
  title: string;
  slug: string;
  excerpt?: string | null;
  publishedAt?: Date | null;
  coverUrl?: string | null;
  authorName?: string | null;
  siteUrl: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: opts.title,
    description: opts.excerpt ?? undefined,
    datePublished: opts.publishedAt?.toISOString() ?? undefined,
    image: opts.coverUrl ?? undefined,
    author: opts.authorName
      ? { "@type": "Person", name: opts.authorName }
      : { "@type": "Organization", name: "Department of Mathematics, OAU" },
    publisher: {
      "@type": "Organization",
      name: "Department of Mathematics, Obafemi Awolowo University",
      url: opts.siteUrl,
    },
    url: `${opts.siteUrl}/news/${opts.slug}`,
    mainEntityOfPage: `${opts.siteUrl}/news/${opts.slug}`,
  };
}

/** Build a Course JSON-LD for a course page. */
export function buildCourseJsonLd(opts: {
  title: string;
  code: string;
  slug: string;
  description?: string | null;
  siteUrl: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Course",
    name: opts.title,
    courseCode: opts.code,
    description: opts.description ?? undefined,
    provider: {
      "@type": "CollegeOrUniversity",
      name: "Department of Mathematics, Obafemi Awolowo University",
      url: opts.siteUrl,
    },
    url: `${opts.siteUrl}/students/courses/${opts.slug}`,
  };
}

/** Build a ScholarlyArticle JSON-LD for a published journal article. */
export function buildScholarlyArticleJsonLd(opts: {
  title: string;
  slug: string;
  abstract?: string | null;
  keywords?: string[];
  doi?: string | null;
  publishedAt?: Date | null;
  authors?: Array<{ name: string; orcid?: string | null }>;
  siteUrl: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "ScholarlyArticle",
    headline: opts.title,
    name: opts.title,
    description: opts.abstract ?? undefined,
    keywords: opts.keywords?.join(", ") ?? undefined,
    sameAs: opts.doi ? [`https://doi.org/${opts.doi}`] : undefined,
    datePublished: opts.publishedAt?.toISOString() ?? undefined,
    author: opts.authors?.map((a) => ({
      "@type": "Person",
      name: a.name,
      sameAs: a.orcid ? [`https://orcid.org/${a.orcid}`] : undefined,
    })),
    publisher: {
      "@type": "Organization",
      name: "Department of Mathematics, Obafemi Awolowo University",
      url: opts.siteUrl,
    },
    url: `${opts.siteUrl}/journal/articles/${opts.slug}`,
    mainEntityOfPage: `${opts.siteUrl}/journal/articles/${opts.slug}`,
    isAccessibleForFree: true,
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
