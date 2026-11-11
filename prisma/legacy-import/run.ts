/**
 * One-off, idempotent import of content that is publicly shown on the old
 * site (https://maths.oauife.edu.ng), kept in data.json. Fills the site
 * settings and pages that still hold [SAMPLE] or placeholder text, and
 * creates published lecturer profiles for the academic staff listed there.
 *
 *   npm run db:import-legacy
 *
 * Never overwrites content an admin has edited: a setting is replaced only
 * when it is missing or still contains "[SAMPLE]"; a page only while its
 * body still contains "[PLACEHOLDER"; a lecturer only when no profile exists
 * for that email. Not imported on purpose: photos (base64 on the old site;
 * upload through /admin), personal phone numbers and non-institutional
 * emails, publications (free-text citations), and alumni records
 * (personal data that needs each person's consent).
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

type Lecturer = {
  key: string; fullName: string; honorific: string; rank: string; email: string;
  office: string | null; bio: string; scholarUrl: string | null; researchGateUrl: string | null;
};
const data = JSON.parse(readFileSync(path.join(__dirname, "data.json"), "utf8")) as {
  identity: unknown; hod: unknown; hero: unknown; contact: unknown; footer: unknown;
  pages: Record<string, string>; lecturers: Lecturer[];
};

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

async function main() {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  const summary = { settings: 0, pages: 0, lecturers: 0 };

  const settings: Array<[string, unknown]> = [
    ["identity", data.identity], ["hod.welcomeAddress", data.hod], ["homepage.hero", data.hero],
    ["contact.details", data.contact], ["footer.text", data.footer],
  ];
  for (const [key, value] of settings) {
    const row = await db.siteSetting.findUnique({ where: { key } });
    if (row && !JSON.stringify(row.value).includes("[SAMPLE]")) continue;
    await db.siteSetting.upsert({
      where: { key },
      create: { key, value: value as Prisma.InputJsonValue },
      update: { value: value as Prisma.InputJsonValue },
    });
    summary.settings++;
  }

  for (const [slug, body] of Object.entries(data.pages)) {
    const page = await db.page.findUnique({ where: { slug } });
    if (!page || !page.body.includes("[PLACEHOLDER")) continue;
    await db.page.update({ where: { slug }, data: { body, status: "PUBLISHED" } });
    summary.pages++;
  }

  let order = ((await db.lecturerProfile.aggregate({ _max: { order: true } }))._max.order ?? -1) + 1;
  for (const l of data.lecturers) {
    const existingUser = await db.user.findUnique({ where: { email: l.email }, include: { lecturerProfile: true } });
    if (existingUser?.lecturerProfile) continue;
    const slug = slugify(l.fullName);
    if (await db.lecturerProfile.findUnique({ where: { slug } })) continue;
    const user = existingUser ?? (await db.user.create({ data: { email: l.email, name: l.fullName, isActive: true } }));
    await db.userRole.upsert({
      where: { userId_role: { userId: user.id, role: "LECTURER" } },
      create: { userId: user.id, role: "LECTURER" },
      update: {},
    });
    await db.lecturerProfile.create({
      data: {
        userId: user.id, slug, fullName: l.fullName, honorific: l.honorific || null,
        rank: l.rank as never, bio: l.bio, officeLocation: l.office, publicEmail: l.email,
        scholarUrl: l.scholarUrl, researchGateUrl: l.researchGateUrl, status: "PUBLISHED", order: order++,
      },
    });
    summary.lecturers++;
  }

  console.log(`Imported: ${summary.settings} settings, ${summary.pages} pages, ${summary.lecturers} lecturers.`);
  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
