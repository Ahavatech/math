import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { PLACEHOLDER_PROSE } from "../src/lib/placeholder";

/**
 * Nine research areas and three programmes, titled exactly as recorded in
 * docs/SCOPE.md's "What the site has today" table. Summary/body text is a
 * clearly labelled placeholder (SCOPE.md gives titles only, not prose), not
 * invented department fact. M.Sc. specialisations are deliberately not
 * seeded per the prompt ("do not invent... that stage will fetch them from
 * the live site").
 */

const RESEARCH_AREAS = [
  "Algebra and Number Theory",
  "Analysis",
  "Differential Equations",
  "Fluid Mechanics",
  "Numerical Analysis",
  "Graph Theory and Combinatorics",
  "Topology and Geometry",
  "Mathematical Biology",
  "Solid Mechanics",
] as const;

const PROGRAMMES = [
  {
    slug: "bsc-mathematics",
    level: "BSC" as const,
    title: "B.Sc. Mathematics",
    duration: "4 years",
  },
  {
    slug: "msc-mathematics",
    level: "MSC" as const,
    title: "M.Sc. Mathematics",
    duration: "1.5 to 2 years",
  },
  {
    slug: "phd-mathematics",
    level: "PHD" as const,
    title: "Ph.D. Mathematics",
    duration: "3 to 5 years",
  },
];

/**
 * Header and footer navigation, derived from docs/SCOPE.md's sitemap
 * section. Real routes the build already defines a destination for.
 */
const NAV_ITEMS: Array<{
  label: string;
  href: string;
  location: "HEADER" | "FOOTER";
  order: number;
}> = [
  { label: "Home", href: "/", location: "HEADER", order: 0 },
  { label: "About", href: "/about", location: "HEADER", order: 1 },
  { label: "Programmes", href: "/programmes", location: "HEADER", order: 2 },
  { label: "Research", href: "/research", location: "HEADER", order: 3 },
  { label: "Staff", href: "/staff", location: "HEADER", order: 4 },
  { label: "News", href: "/news", location: "HEADER", order: 5 },
  { label: "Events", href: "/events", location: "HEADER", order: 6 },
  { label: "Alumni", href: "/alumni", location: "HEADER", order: 7 },
  { label: "Students", href: "/students", location: "HEADER", order: 8 },
  { label: "Journal", href: "/journal", location: "HEADER", order: 9 },
  { label: "Contact", href: "/contact", location: "HEADER", order: 10 },
  { label: "About", href: "/about", location: "FOOTER", order: 0 },
  { label: "Programmes", href: "/programmes", location: "FOOTER", order: 1 },
  { label: "Journal", href: "/journal", location: "FOOTER", order: 2 },
  { label: "Student Resources", href: "/students", location: "FOOTER", order: 3 },
  // No "Contact" FOOTER link here: SiteFooter already renders a
  // dedicated Contact block from SiteSetting; a seeded nav link with
  // the same label duplicated it (Stage 05 fix).
];

/**
 * Default site settings. These values are placeholder content (the
 * department has supplied no real HOD address, hero copy, stats or
 * contact details yet per PRODUCT.md), so every text value is marked
 * [SAMPLE] for easy removal once real content arrives.
 */
/**
 * Shapes here must match src/server/services/site-settings.ts's
 * SETTINGS_REGISTRY schemas exactly - getSetting() falls back to that
 * key's registry default when a stored value fails validation, so a
 * drifted seed value here would silently vanish on read, not error.
 */
const SITE_SETTINGS: Array<{ key: string; value: unknown }> = [
  {
    key: "identity",
    value: {
      name: "Department of Mathematics",
      tagline: "[SAMPLE] For learning and culture",
      logoId: null,
    },
  },
  {
    key: "hod.welcomeAddress",
    value: {
      name: "[SAMPLE] Prof. B. S. Ogundare",
      title: "[SAMPLE] Head of Department",
      photoId: null,
      message: "<p>[SAMPLE] Welcome to the Department of Mathematics.</p>",
    },
  },
  {
    key: "homepage.hero",
    value: {
      heading: "[SAMPLE] Department of Mathematics",
      subheading: "[SAMPLE] Obafemi Awolowo University, Ile-Ife",
      imageId: null,
      ctaLabel: "[SAMPLE] Explore programmes",
      ctaHref: "/programmes",
    },
  },
  {
    key: "homepage.stats",
    value: {
      staff: { mode: "auto", manualValue: null },
      alumni: { mode: "auto", manualValue: null },
      programmes: { mode: "auto", manualValue: null },
      researchAreas: { mode: "auto", manualValue: null },
    },
  },
  {
    key: "contact.details",
    value: {
      address: "[SAMPLE] Department of Mathematics, OAU, Ile-Ife, Nigeria",
      phones: ["[SAMPLE] +234 000 000 0000"],
      email: "[SAMPLE] maths@oauife.edu.ng",
      officeHours: "[SAMPLE] Monday to Friday, 9am to 4pm",
      mapLat: null,
      mapLng: null,
    },
  },
  {
    key: "footer.text",
    value: {
      text: "[SAMPLE] Department of Mathematics, Obafemi Awolowo University.",
    },
  },
];

/**
 * Seeded from https://maths.oauife.edu.ng (fetched 2026-10-10). The
 * live site is a single long page with no separate About/History/
 * Mission pages, so only what was actually found is quoted verbatim;
 * everything else is a clearly marked placeholder, never invented.
 * See docs/prompts/05-media-site-content.md item 5.
 */
const PAGES: Array<{ slug: string; title: string; body: string; needsReview: boolean }> = [
  {
    slug: "about",
    title: "About",
    body:
      "<p>The Department of Mathematics at OAU is committed to excellence in mathematical " +
      "education, cutting-edge research, and forming mathematical minds from Ile-Ife to the " +
      "global stage.</p>" +
      "<p>[PLACEHOLDER - the live site has no further About prose beyond this fragment. " +
      "Imported from the old site, needs HOD review.]</p>",
    needsReview: true,
  },
  {
    slug: "history",
    title: "History",
    body:
      "<p>Faculty of Science, established 1962. 60+ years of excellence.</p>" +
      "<p>[PLACEHOLDER - the live site has no narrative department history beyond these two " +
      "facts. Imported from the old site, needs HOD review.]</p>",
    needsReview: true,
  },
  {
    slug: "mission-vision",
    title: "Mission and Vision",
    body:
      "<p>[PLACEHOLDER - no mission or vision statement was found on the live site. " +
      "Imported from the old site, needs HOD review.]</p>",
    needsReview: true,
  },
  {
    slug: "statistics-note",
    title: "Statistics Note",
    body:
      "<p>[PLACEHOLDER - no existing text about the Statistics department split was found on " +
      "the live site; see docs/DECISIONS.md's open question on this. Imported from the old " +
      "site, needs HOD review.]</p>",
    needsReview: true,
  },
];

/**
 * Real prose fetched via WebFetch from https://maths.oauife.edu.ng (Stage
 * 06), keyed by the seed title/slug above. Only ever applied to a row
 * whose summary is still exactly PLACEHOLDER_PROSE, so an HOD edit is
 * never overwritten - see the seed() fill pass below.
 */
const RESEARCH_AREA_CONTENT: Record<string, string> = {
  "Algebra and Number Theory":
    "Group theory, ring theory, algebraic number theory, and arithmetic geometry with connections to cryptography and coding theory.",
  Analysis:
    "Real and complex analysis, functional analysis, harmonic analysis, and operator theory on Banach and Hilbert spaces.",
  "Differential Equations":
    "Ordinary and partial differential equations, dynamical systems, fluid mechanics, and mathematical modelling of physical phenomena.",
  "Fluid Mechanics":
    "Computational fluid dynamics, viscous flow, heat and mass transfer, magnetohydrodynamics, and reaction-diffusion systems.",
  "Numerical Analysis":
    "Computational mathematics, numerical solutions to differential equations, approximation theory, and scientific computing.",
  "Graph Theory and Combinatorics":
    "Discrete mathematics, combinatorial optimisation, graph algorithms, and applications to network science and operations research.",
  "Topology and Geometry":
    "Point-set and algebraic topology, differential geometry, manifold theory, and connections to theoretical physics.",
  "Mathematical Biology":
    "Epidemiological modelling, population dynamics, biomathematics, and computational approaches to biological systems.",
  "Solid Mechanics":
    "Elasticity, plasticity, composite mechanics, phase change mechanics, and associated multi-field problems, bridging rigorous mathematical analysis with structural and material science applications.",
};

const PROGRAMME_CONTENT: Record<string, string> = {
  "bsc-mathematics":
    "A comprehensive programme covering algebra, analysis, geometry, and applied mathematics. Strong emphasis on problem-solving and mathematical reasoning.",
  "msc-mathematics": "Advanced coursework and research in pure or applied mathematics.",
  "phd-mathematics":
    "Original research contributing to the frontiers of mathematical knowledge, supervised by distinguished faculty with international research profiles.",
};

/** Exactly as listed on the live site's M.Sc. programme section, in its own order. */
const MSC_SPECIALISATIONS = [
  "Algebra & Number Theory",
  "Mathematical Analysis & Functional Analysis",
  "Differential Equations (Ordinary & Partial)",
  "Numerical Analysis & Computational Mathematics",
  "Fluid Mechanics & Mathematical Physics",
  "Topology & Geometry",
  "Mathematical Biology & Epidemiological Modelling",
  "Graph Theory & Combinatorics",
  "Fixed Point Theory",
  "Reaction-Diffusion Equations",
] as const;

export async function seed(db: PrismaClient): Promise<void> {
  for (const title of RESEARCH_AREAS) {
    const slug = slugify(title);
    await db.researchArea.upsert({
      where: { slug },
      create: {
        slug,
        title,
        summary: PLACEHOLDER_PROSE,
        body: PLACEHOLDER_PROSE,
        status: "PUBLISHED",
      },
      update: {},
    });
  }

  for (const programme of PROGRAMMES) {
    await db.programme.upsert({
      where: { slug: programme.slug },
      create: {
        slug: programme.slug,
        level: programme.level,
        title: programme.title,
        summary: PLACEHOLDER_PROSE,
        body: PLACEHOLDER_PROSE,
        duration: programme.duration,
        admissionRequirements: PLACEHOLDER_PROSE,
        status: "PUBLISHED",
      },
      update: {},
    });
  }

  // Fill real prose into rows still at the placeholder, never touching one
  // an admin has already edited (recognised by no longer matching the
  // placeholder sentinel exactly).
  const researchImportFlags: Record<string, boolean> = {};
  for (const title of RESEARCH_AREAS) {
    const slug = slugify(title);
    const realSummary = RESEARCH_AREA_CONTENT[title];
    const current = await db.researchArea.findUnique({ where: { slug } });
    if (current && realSummary && current.summary === PLACEHOLDER_PROSE) {
      await db.researchArea.update({
        where: { slug },
        data: { summary: realSummary, body: `<p>${realSummary}</p>` },
      });
      researchImportFlags[slug] = true;
    }
  }
  if (Object.keys(researchImportFlags).length > 0) {
    await db.siteSetting.upsert({
      where: { key: "research.importFlags" },
      create: { key: "research.importFlags", value: researchImportFlags },
      update: {},
    });
  }

  const programmeImportFlags: Record<string, boolean> = {};
  for (const programme of PROGRAMMES) {
    const realSummary = PROGRAMME_CONTENT[programme.slug];
    const current = await db.programme.findUnique({ where: { slug: programme.slug } });
    if (current && realSummary && current.summary === PLACEHOLDER_PROSE) {
      await db.programme.update({
        where: { slug: programme.slug },
        data: { summary: realSummary, body: `<p>${realSummary}</p>` },
      });
      programmeImportFlags[programme.slug] = true;
    }
  }
  if (Object.keys(programmeImportFlags).length > 0) {
    await db.siteSetting.upsert({
      where: { key: "programmes.importFlags" },
      create: { key: "programmes.importFlags", value: programmeImportFlags },
      update: {},
    });
  }

  // M.Sc. specialisations: create only the ones missing by title, under
  // the M.Sc. programme. Never touches an existing row.
  const mscProgramme = await db.programme.findUnique({ where: { slug: "msc-mathematics" } });
  if (mscProgramme) {
    for (let i = 0; i < MSC_SPECIALISATIONS.length; i++) {
      const title = MSC_SPECIALISATIONS[i];
      const existing = await db.specialisation.findFirst({
        where: { programmeId: mscProgramme.id, title },
      });
      if (!existing) {
        await db.specialisation.create({
          data: { programmeId: mscProgramme.id, title, description: PLACEHOLDER_PROSE, order: i },
        });
      }
    }
  }

  for (const item of NAV_ITEMS) {
    const existing = await db.navItem.findFirst({
      where: { href: item.href, location: item.location },
    });
    if (!existing) {
      await db.navItem.create({
        data: {
          label: item.label,
          href: item.href,
          location: item.location,
          order: item.order,
        },
      });
    }
  }

  for (const setting of SITE_SETTINGS) {
    await db.siteSetting.upsert({
      where: { key: setting.key },
      create: { key: setting.key, value: setting.value as never },
      update: {},
    });
  }

  const importFlags: Record<string, boolean> = {};
  for (const page of PAGES) {
    await db.page.upsert({
      where: { slug: page.slug },
      create: { slug: page.slug, title: page.title, body: page.body, status: "DRAFT" },
      update: {},
    });
    if (page.needsReview) importFlags[page.slug] = true;
  }
  if (Object.keys(importFlags).length > 0) {
    await db.siteSetting.upsert({
      where: { key: "pages.importFlags" },
      create: { key: "pages.importFlags", value: importFlags },
      update: {},
    });
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  if (!adminEmail) {
    console.warn(
      "SEED_ADMIN_EMAIL is not set; skipping the super admin seed user.",
    );
  } else {
    const admin = await db.user.upsert({
      where: { email: adminEmail },
      create: { email: adminEmail, name: "Super Admin", isActive: true },
      update: {},
    });

    await db.userRole.upsert({
      where: { userId_role: { userId: admin.id, role: "SUPER_ADMIN" } },
      create: { userId: admin.id, role: "SUPER_ADMIN" },
      update: {},
    });
  }
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter });
  try {
    await seed(db);
  } finally {
    await db.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
