import { describe, expect, it, beforeAll, afterAll, afterEach } from "vitest";
import { getTestDb } from "../../../../tests/unit/database/test-db";
import { getFeaturedLecturer } from "../homepage";
import { setSetting } from "../site-settings";

const db = await getTestDb();

const RUN = Date.now().toString(36);

describe.skipIf(db === null)("getFeaturedLecturer", () => {
  let actorId: string;
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    const actor = await db!.user.create({ data: { email: `featured-lecturer-test-actor-${RUN}@example.com`, name: "Actor" } });
    actorId = actor.id;
  });

  afterAll(async () => {
    await db!.auditLog.deleteMany({ where: { actorId } });
    await db!.user.delete({ where: { id: actorId } });
    await db!.siteSetting.deleteMany({ where: { key: "homepage.featuredLecturer" } });
    await db!.contentRevision.deleteMany({ where: { entityId: "homepage.featuredLecturer" } });
    await db?.$disconnect();
  });

  afterEach(async () => {
    if (createdUserIds.length) {
      await db!.contentRevision.deleteMany({ where: { entityType: "LecturerProfile" } });
      await db!.auditLog.deleteMany({ where: { entityType: "LecturerProfile" } });
      await db!.lecturerProfile.deleteMany({ where: { userId: { in: createdUserIds } } });
      await db!.user.deleteMany({ where: { id: { in: createdUserIds } } });
      createdUserIds.length = 0;
    }
    await setSetting(db!, "homepage.featuredLecturer", { mode: "automatic", lecturerProfileId: null }, actorId);
  });

  async function makeEligibleLecturer(suffix: string, overrides: Record<string, unknown> = {}) {
    const user = await db!.user.create({ data: { email: `featured-${suffix}@example.com`, name: `Featured ${suffix}` } });
    createdUserIds.push(user.id);
    const photo = await db!.mediaAsset.create({
      data: { provider: "cloudinary", publicId: `featured-${suffix}`, url: `https://example.com/${suffix}.jpg`, width: 10, height: 10, bytes: 1, format: "jpg" },
    });
    const profile = await db!.lecturerProfile.create({
      data: {
        userId: user.id,
        slug: `featured-${suffix}`,
        fullName: `Featured ${suffix}`,
        rank: "LECTURER_I",
        status: "PUBLISHED",
        photoId: photo.id,
        bio: "A real bio.",
        ...overrides,
      },
    });
    return profile;
  }

  it("returns null when there is no eligible profile", async () => {
    expect(await getFeaturedLecturer(db!)).toBeNull();
  });

  it("automatic mode picks only among published, active, photo-and-bio profiles", async () => {
    const noPhoto = await db!.user.create({ data: { email: `featured-no-photo-${RUN}@example.com`, name: "No Photo" } });
    createdUserIds.push(noPhoto.id);
    await db!.lecturerProfile.create({
      data: { userId: noPhoto.id, slug: "featured-no-photo", fullName: "No Photo", rank: "LECTURER_I", status: "PUBLISHED", bio: "Has a bio but no photo." },
    });

    const eligible = await makeEligibleLecturer("auto-eligible");

    const picked = await getFeaturedLecturer(db!);
    expect(picked?.id).toBe(eligible.id);
  });

  it("manual mode features the chosen profile", async () => {
    const chosen = await makeEligibleLecturer("manual-chosen");
    const other = await makeEligibleLecturer("manual-other");
    await setSetting(db!, "homepage.featuredLecturer", { mode: "manual", lecturerProfileId: chosen.id }, actorId);

    const picked = await getFeaturedLecturer(db!);
    expect(picked?.id).toBe(chosen.id);
    expect(picked?.id).not.toBe(other.id);
  });

  it("falls back to automatic when the manually chosen profile is no longer eligible (e.g. unpublished)", async () => {
    const chosen = await makeEligibleLecturer("manual-ineligible");
    await db!.lecturerProfile.update({ where: { id: chosen.id }, data: { status: "DRAFT" } });
    const fallback = await makeEligibleLecturer("manual-fallback");
    await setSetting(db!, "homepage.featuredLecturer", { mode: "manual", lecturerProfileId: chosen.id }, actorId);

    const picked = await getFeaturedLecturer(db!);
    expect(picked?.id).toBe(fallback.id);
  });

  it("excludes emeritus and deactivated-account profiles from the automatic pool", async () => {
    const emeritus = await makeEligibleLecturer("auto-emeritus", { isEmeritus: true });
    const deactivatedUser = await db!.user.create({ data: { email: `featured-deactivated-${RUN}@example.com`, name: "Deactivated", isActive: false } });
    createdUserIds.push(deactivatedUser.id);
    await db!.lecturerProfile.create({
      data: { userId: deactivatedUser.id, slug: "featured-deactivated", fullName: "Deactivated", rank: "LECTURER_I", status: "PUBLISHED", bio: "bio" },
    });
    const eligible = await makeEligibleLecturer("auto-only-eligible");

    const picked = await getFeaturedLecturer(db!);
    expect(picked?.id).toBe(eligible.id);
    expect(picked?.id).not.toBe(emeritus.id);
  });
});
