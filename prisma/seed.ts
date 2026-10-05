import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Nine research areas and three programmes, titled exactly as recorded in
 * docs/SCOPE.md's "What the site has today" table. Summary/body text is a
 * clearly labelled placeholder (SCOPE.md gives titles only, not prose), not
 * invented department fact. M.Sc. specialisations are deliberately not
 * seeded per the prompt ("do not invent... that stage will fetch them from
 * the live site").
 */
const PLACEHOLDER_PROSE =
  "Placeholder description. The department will provide final copy for this page.";

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
  { label: "Contact", href: "/contact", location: "FOOTER", order: 4 },
];

/**
 * Default site settings. These values are placeholder content (the
 * department has supplied no real HOD address, hero copy, stats or
 * contact details yet per PRODUCT.md), so every text value is marked
 * [SAMPLE] for easy removal once real content arrives.
 */
const SITE_SETTINGS: Array<{ key: string; value: unknown }> = [
  {
    key: "hod.welcomeAddress",
    value: {
      name: "[SAMPLE] Prof. B. S. Ogundare",
      title: "[SAMPLE] Head of Department",
      message: "[SAMPLE] Welcome to the Department of Mathematics.",
    },
  },
  {
    key: "homepage.hero",
    value: {
      title: "[SAMPLE] Department of Mathematics",
      subtitle: "[SAMPLE] Obafemi Awolowo University, Ile-Ife",
    },
  },
  {
    key: "homepage.stats",
    value: {
      staff: "[SAMPLE] 0",
      alumni: "[SAMPLE] 0",
      programmes: "[SAMPLE] 3",
    },
  },
  {
    key: "contact.details",
    value: {
      address: "[SAMPLE] Department of Mathematics, OAU, Ile-Ife, Nigeria",
      phone: "[SAMPLE] +234 000 000 0000",
      email: "[SAMPLE] maths@oauife.edu.ng",
      officeHours: "[SAMPLE] Monday to Friday, 9am to 4pm",
    },
  },
  {
    key: "footer.text",
    value: {
      text: "[SAMPLE] Department of Mathematics, Obafemi Awolowo University.",
    },
  },
];

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
