import { describe, expect, it, beforeAll, afterAll, afterEach } from "vitest";
import { getTestDb } from "../../../../tests/unit/database/test-db";
import {
  createLecturer,
  getLecturerByUserId,
  updateOwnLecturerProfile,
  updateLecturerAdminFields,
  requestPublishing,
  publishLecturer,
  unpublishLecturer,
  getPublishedLecturerBySlug,
  deriveInviteState,
  computeCompleteness,
  createPublicationForOwner,
  updatePublicationForOwner,
  deletePublicationForOwner,
  reorderPublicationForOwner,
  reorderLecturer,
  listLecturersDirectory,
  sendLecturerInvite,
  OwnershipError,
} from "../lecturers";

const db = await getTestDb();

describe.skipIf(db === null)("lecturers service", () => {
  let actorId: string;
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    const actor = await db!.user.create({ data: { email: "lecturers-test-actor@example.com", name: "Actor" } });
    actorId = actor.id;
  });

  afterEach(async () => {
    if (createdUserIds.length) {
      await db!.userToken.deleteMany({ where: { userId: { in: createdUserIds } } });
      await db!.contentRevision.deleteMany({ where: { entityType: "LecturerProfile" } });
      await db!.auditLog.deleteMany({ where: { actorId: { in: [...createdUserIds, actorId] } } });
      await db!.lecturerProfile.deleteMany({ where: { userId: { in: createdUserIds } } });
      await db!.userRole.deleteMany({ where: { userId: { in: createdUserIds } } });
      await db!.user.deleteMany({ where: { id: { in: createdUserIds } } });
      createdUserIds.length = 0;
    }
  });

  afterAll(async () => {
    await db!.auditLog.deleteMany({ where: { actorId } });
    await db!.user.delete({ where: { id: actorId } });
    await db?.$disconnect();
  });

  it("creates a user with the LECTURER role and a DRAFT profile with a generated slug", async () => {
    const { user, profile } = await createLecturer(
      db!,
      actorId,
      { fullName: "Jane Doe Test", honorific: "Dr.", rank: "LECTURER_I", email: "jane-doe-test@example.com" },
    );
    createdUserIds.push(user.id);

    expect(profile.status).toBe("DRAFT");
    expect(profile.slug).toBe("jane-doe-test");
    const roles = await db!.userRole.findMany({ where: { userId: user.id } });
    expect(roles.map((r) => r.role)).toContain("LECTURER");
  });

  it("reorders by swapping order with the adjacent sibling, no-op at boundaries", async () => {
    const a = await createLecturer(db!, actorId, { fullName: "Reorder A Test", honorific: "", rank: "LECTURER_I", email: "reorder-a-test@example.com" });
    const b = await createLecturer(db!, actorId, { fullName: "Reorder B Test", honorific: "", rank: "LECTURER_I", email: "reorder-b-test@example.com" });
    const c = await createLecturer(db!, actorId, { fullName: "Reorder C Test", honorific: "", rank: "LECTURER_I", email: "reorder-c-test@example.com" });
    createdUserIds.push(a.user.id, b.user.id, c.user.id);

    // Give the fixtures order values well outside the real seeded range
    // so they are guaranteed adjacent to each other (see docs/PATTERNS.md's
    // test-isolation note for this same issue in research-areas reorder).
    await db!.lecturerProfile.update({ where: { id: a.profile.id }, data: { order: 5000 } });
    await db!.lecturerProfile.update({ where: { id: b.profile.id }, data: { order: 5001 } });
    await db!.lecturerProfile.update({ where: { id: c.profile.id }, data: { order: 5002 } });

    await reorderLecturer(db!, b.profile.id, "up");
    let rows = await db!.lecturerProfile.findMany({ where: { id: { in: [a.profile.id, b.profile.id, c.profile.id] } }, orderBy: { order: "asc" } });
    expect(rows.map((r) => r.id)).toEqual([b.profile.id, a.profile.id, c.profile.id]);

    // moving the now-first item up again is a no-op
    await reorderLecturer(db!, b.profile.id, "up");
    rows = await db!.lecturerProfile.findMany({ where: { id: { in: [a.profile.id, b.profile.id, c.profile.id] } }, orderBy: { order: "asc" } });
    expect(rows.map((r) => r.id)).toEqual([b.profile.id, a.profile.id, c.profile.id]);

    // moving the last item down is a no-op
    await reorderLecturer(db!, c.profile.id, "down");
    rows = await db!.lecturerProfile.findMany({ where: { id: { in: [a.profile.id, b.profile.id, c.profile.id] } }, orderBy: { order: "asc" } });
    expect(rows.map((r) => r.id)).toEqual([b.profile.id, a.profile.id, c.profile.id]);
  });

  it("adds the LECTURER role to an existing user without removing their other roles", async () => {
    const existing = await db!.user.create({
      data: { email: "existing-hod-test@example.com", name: "Existing HOD", roles: { create: { role: "HOD" } } },
    });
    createdUserIds.push(existing.id);

    const { user } = await createLecturer(db!, actorId, {
      fullName: "Existing HOD",
      honorific: "Prof.",
      rank: "PROFESSOR",
      email: "existing-hod-test@example.com",
    });

    expect(user.id).toBe(existing.id);
    const roles = await db!.userRole.findMany({ where: { userId: existing.id } });
    expect(roles.map((r) => r.role).sort()).toEqual(["HOD", "LECTURER"]);
  });

  it("generates a collision-safe slug for a duplicate name", async () => {
    const a = await createLecturer(db!, actorId, {
      fullName: "Dup Name Test",
      honorific: "",
      rank: "LECTURER_I",
      email: "dup-a-test@example.com",
    });
    const b = await createLecturer(db!, actorId, {
      fullName: "Dup Name Test",
      honorific: "",
      rank: "LECTURER_I",
      email: "dup-b-test@example.com",
    });
    createdUserIds.push(a.user.id, b.user.id);
    expect(a.profile.slug).toBe("dup-name-test");
    expect(b.profile.slug).toBe("dup-name-test-2");
  });

  it("a lecturer cannot edit another lecturer's profile (ownership is structural: self-edit is always keyed by the caller's own userId)", async () => {
    const a = await createLecturer(db!, actorId, {
      fullName: "Owner A Test",
      honorific: "",
      rank: "LECTURER_I",
      email: "owner-a-test@example.com",
    });
    const b = await createLecturer(db!, actorId, {
      fullName: "Owner B Test",
      honorific: "",
      rank: "LECTURER_I",
      email: "owner-b-test@example.com",
    });
    createdUserIds.push(a.user.id, b.user.id);

    await updateOwnLecturerProfile(db!, a.user.id, {
      photoId: null,
      honorific: "",
      bio: "A's bio",
      researchAreaIds: [],
      officeLocation: "",
      officeHours: "",
      publicEmail: "",
      phone: "",
      scholarUrl: "",
      orcid: "",
      researchGateUrl: "",
      linkedinUrl: "",
      supervisionText: "",
    }, a.user.id);
    const bProfile = await getLecturerByUserId(db!, b.user.id);
    expect(bProfile?.bio).not.toBe("A's bio");
  });

  it("a lecturer cannot edit another lecturer's publication (IDOR check)", async () => {
    const a = await createLecturer(db!, actorId, {
      fullName: "Pub Owner A",
      honorific: "",
      rank: "LECTURER_I",
      email: "pub-owner-a@example.com",
    });
    const b = await createLecturer(db!, actorId, {
      fullName: "Pub Owner B",
      honorific: "",
      rank: "LECTURER_I",
      email: "pub-owner-b@example.com",
    });
    createdUserIds.push(a.user.id, b.user.id);

    const pub = await createPublicationForOwner(db!, a.user.id, {
      title: "A's paper",
      authorsText: "A",
      venue: "",
      year: 2020,
      url: "",
      doi: "",
    });

    await expect(
      updatePublicationForOwner(db!, b.user.id, pub.id, {
        title: "Hijacked",
        authorsText: "B",
        venue: "",
        year: 2021,
        url: "",
        doi: "",
      }),
    ).rejects.toThrow(OwnershipError);

    await expect(deletePublicationForOwner(db!, b.user.id, pub.id)).rejects.toThrow(OwnershipError);
    await expect(reorderPublicationForOwner(db!, b.user.id, pub.id, "up")).rejects.toThrow(OwnershipError);
  });

  it("admin field changes (slug) push the old slug into previousSlugs", async () => {
    const { user, profile } = await createLecturer(db!, actorId, {
      fullName: "Slug Change Test",
      honorific: "",
      rank: "LECTURER_I",
      email: "slug-change-test@example.com",
    });
    createdUserIds.push(user.id);

    const updated = await updateLecturerAdminFields(db!, actorId, profile.id, {
      slug: "new-slug-test",
      rank: profile.rank,
      status: profile.status,
      order: profile.order,
      isEmeritus: profile.isEmeritus,
    });

    expect(updated.slug).toBe("new-slug-test");
    expect(updated.previousSlugs).toContain("slug-change-test");
  });

  it("requestPublishing rejects an incomplete profile and succeeds once complete", async () => {
    const { user, profile } = await createLecturer(db!, actorId, {
      fullName: "Completeness Test",
      honorific: "",
      rank: "LECTURER_I",
      email: "completeness-test@example.com",
    });
    createdUserIds.push(user.id);

    await expect(requestPublishing(db!, user.id)).rejects.toThrow(/complete/i);

    const area = await db!.researchArea.create({
      data: { slug: `test-area-${Date.now()}`, title: "Test Area", summary: "s", body: "b", status: "PUBLISHED" },
    });
    const photo = await db!.mediaAsset.create({
      data: { provider: "cloudinary", publicId: `test-photo-${Date.now()}`, url: "https://res.cloudinary.com/x/y.jpg", alt: "Test photo" },
    });
    await updateOwnLecturerProfile(db!, user.id, {
      photoId: photo.id,
      honorific: "",
      bio: "A complete bio",
      researchAreaIds: [area.id],
      officeLocation: "",
      officeHours: "",
      publicEmail: "",
      phone: "",
      scholarUrl: "",
      orcid: "",
      researchGateUrl: "",
      linkedinUrl: "",
      supervisionText: "",
    }, user.id);

    const requested = await requestPublishing(db!, user.id);
    expect(requested.publishRequestedAt).not.toBeNull();

    await db!.researchArea.delete({ where: { id: area.id } });
    await db!.lecturerProfile.update({ where: { userId: user.id }, data: { photoId: null } });
    await db!.mediaAsset.delete({ where: { id: photo.id } });
  });

  it("publishLecturer and unpublishLecturer toggle public visibility", async () => {
    const { user, profile } = await createLecturer(db!, actorId, {
      fullName: "Publish Toggle Test",
      honorific: "",
      rank: "LECTURER_I",
      email: "publish-toggle-test@example.com",
    });
    createdUserIds.push(user.id);

    await publishLecturer(db!, actorId, profile.id);
    const published = await getPublishedLecturerBySlug(db!, profile.slug);
    expect(published?.id).toBe(profile.id);

    await unpublishLecturer(db!, actorId, profile.id);
    const afterUnpublish = await getPublishedLecturerBySlug(db!, profile.slug);
    expect(afterUnpublish).toBeNull();
  });

  it("a deactivated lecturer's profile disappears from public queries immediately", async () => {
    const { user, profile } = await createLecturer(db!, actorId, {
      fullName: "Deactivate Test",
      honorific: "",
      rank: "LECTURER_I",
      email: "deactivate-test@example.com",
    });
    createdUserIds.push(user.id);
    await publishLecturer(db!, actorId, profile.id);
    expect(await getPublishedLecturerBySlug(db!, profile.slug)).not.toBeNull();

    await db!.user.update({ where: { id: user.id }, data: { isActive: false } });
    expect(await getPublishedLecturerBySlug(db!, profile.slug)).toBeNull();
  });

  it("the public query result never serialises the login email or a password hash", async () => {
    const loginEmail = "secret-login-email-test@example.com";
    const { user, profile } = await createLecturer(db!, actorId, {
      fullName: "Serialization Test",
      honorific: "",
      rank: "LECTURER_I",
      email: loginEmail,
    });
    createdUserIds.push(user.id);
    await publishLecturer(db!, actorId, profile.id);

    const published = await getPublishedLecturerBySlug(db!, profile.slug);
    const serialized = JSON.stringify(published);

    expect(serialized).not.toContain(loginEmail);
    expect(serialized).not.toContain("passwordHash");
  });

  it("sendLecturerInvite issues a token and derives invite state as 'invited'", async () => {
    const { user } = await createLecturer(db!, actorId, {
      fullName: "Invite Send Test",
      honorific: "",
      rank: "LECTURER_I",
      email: "invite-send-test@example.com",
    });
    createdUserIds.push(user.id);

    expect(deriveInviteState(null, null)).toBe("not_invited");

    await sendLecturerInvite(db!, actorId, user.id);
    const token = await db!.userToken.findFirst({ where: { userId: user.id, type: "INVITE" } });
    expect(deriveInviteState(null, token)).toBe("invited");
  });

  describe("listLecturersDirectory", () => {
    it("only includes published, active-account profiles", async () => {
      const draft = await createLecturer(db!, actorId, { fullName: "Directory Draft Test", honorific: "", rank: "LECTURER_I", email: "directory-draft-test@example.com" });
      const published = await createLecturer(db!, actorId, { fullName: "Directory Published Test", honorific: "", rank: "LECTURER_I", email: "directory-published-test@example.com" });
      const deactivated = await createLecturer(db!, actorId, { fullName: "Directory Deactivated Test", honorific: "", rank: "LECTURER_I", email: "directory-deactivated-test@example.com" });
      createdUserIds.push(draft.user.id, published.user.id, deactivated.user.id);
      await publishLecturer(db!, actorId, published.profile.id);
      await publishLecturer(db!, actorId, deactivated.profile.id);
      await db!.user.update({ where: { id: deactivated.user.id }, data: { isActive: false } });

      const list = await listLecturersDirectory(db!);
      const ids = list.map((l) => l.id);
      expect(ids).toContain(published.profile.id);
      expect(ids).not.toContain(draft.profile.id);
      expect(ids).not.toContain(deactivated.profile.id);
    });

    it("includes both emeritus and non-emeritus published profiles (caller splits them)", async () => {
      const emeritus = await createLecturer(db!, actorId, { fullName: "Directory Emeritus Test", honorific: "", rank: "PROFESSOR", email: "directory-emeritus-test@example.com" });
      createdUserIds.push(emeritus.user.id);
      await publishLecturer(db!, actorId, emeritus.profile.id);
      await db!.lecturerProfile.update({ where: { id: emeritus.profile.id }, data: { isEmeritus: true } });

      const list = await listLecturersDirectory(db!);
      const found = list.find((l) => l.id === emeritus.profile.id);
      expect(found?.isEmeritus).toBe(true);
    });

    it("filters by rank", async () => {
      const prof = await createLecturer(db!, actorId, { fullName: "Directory Rank Prof Test", honorific: "", rank: "PROFESSOR", email: "directory-rank-prof-test@example.com" });
      const lect = await createLecturer(db!, actorId, { fullName: "Directory Rank Lect Test", honorific: "", rank: "LECTURER_I", email: "directory-rank-lect-test@example.com" });
      createdUserIds.push(prof.user.id, lect.user.id);
      await publishLecturer(db!, actorId, prof.profile.id);
      await publishLecturer(db!, actorId, lect.profile.id);

      const list = await listLecturersDirectory(db!, { rank: "PROFESSOR" });
      const ids = list.map((l) => l.id);
      expect(ids).toContain(prof.profile.id);
      expect(ids).not.toContain(lect.profile.id);
    });

    it("matches a plain-ASCII search query against a name with Yoruba diacritics", async () => {
      const { user, profile } = await createLecturer(db!, actorId, {
        fullName: "Adéṣọlá Yoruba Search Test",
        honorific: "",
        rank: "LECTURER_I",
        email: "directory-yoruba-search-test@example.com",
      });
      createdUserIds.push(user.id);
      await publishLecturer(db!, actorId, profile.id);

      const found = await listLecturersDirectory(db!, { search: "adesola" });
      expect(found.map((l) => l.id)).toContain(profile.id);

      const notFound = await listLecturersDirectory(db!, { search: "zzz-nonexistent" });
      expect(notFound.map((l) => l.id)).not.toContain(profile.id);
    });

    it("filters by research area", async () => {
      const area = await db!.researchArea.create({
        data: { title: "Directory Filter Area Test", slug: "directory-filter-area-test", summary: "", body: "", status: "PUBLISHED", order: 9000 },
      });
      const linked = await createLecturer(db!, actorId, { fullName: "Directory Area Linked Test", honorific: "", rank: "LECTURER_I", email: "directory-area-linked-test@example.com" });
      const unlinked = await createLecturer(db!, actorId, { fullName: "Directory Area Unlinked Test", honorific: "", rank: "LECTURER_I", email: "directory-area-unlinked-test@example.com" });
      createdUserIds.push(linked.user.id, unlinked.user.id);
      await publishLecturer(db!, actorId, linked.profile.id);
      await publishLecturer(db!, actorId, unlinked.profile.id);
      await db!.lecturerProfile.update({ where: { id: linked.profile.id }, data: { researchAreas: { connect: { id: area.id } } } });

      try {
        const list = await listLecturersDirectory(db!, { researchAreaSlug: "directory-filter-area-test" });
        const ids = list.map((l) => l.id);
        expect(ids).toContain(linked.profile.id);
        expect(ids).not.toContain(unlinked.profile.id);
      } finally {
        await db!.researchArea.delete({ where: { id: area.id } });
      }
    });

    it("returns an empty array for a search that matches nobody", async () => {
      const list = await listLecturersDirectory(db!, { search: "no-such-lecturer-zzz" });
      expect(list).toEqual([]);
    });
  });
});

describe("deriveInviteState", () => {
  it("not_invited when there is no token and no password", () => {
    expect(deriveInviteState(null, null)).toBe("not_invited");
  });

  it("invited when an unused, unexpired token exists", () => {
    expect(deriveInviteState(null, { usedAt: null, expiresAt: new Date(Date.now() + 60_000) })).toBe("invited");
  });

  it("expired when the token's expiry has passed and no password is set", () => {
    expect(deriveInviteState(null, { usedAt: null, expiresAt: new Date(Date.now() - 1000) })).toBe("expired");
  });

  it("accepted when the user has a password hash regardless of token state", () => {
    expect(deriveInviteState("hash", { usedAt: null, expiresAt: new Date(Date.now() - 1000) })).toBe("accepted");
    expect(deriveInviteState("hash", null)).toBe("accepted");
  });
});

describe("computeCompleteness", () => {
  it("is 0 with nothing filled", () => {
    expect(computeCompleteness({ photoId: null, bio: null, researchAreaCount: 0 })).toBe(0);
  });

  it("is 100 with everything filled", () => {
    expect(computeCompleteness({ photoId: "x", bio: "some bio", researchAreaCount: 1 })).toBe(100);
  });

  it("is partial with some fields filled", () => {
    const value = computeCompleteness({ photoId: "x", bio: null, researchAreaCount: 0 });
    expect(value).toBeGreaterThan(0);
    expect(value).toBeLessThan(100);
  });
});
