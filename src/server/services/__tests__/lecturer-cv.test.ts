import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/cloudinary", () => ({
  cloudinary: {
    api: {
      resource: vi.fn(),
      delete_resources: vi.fn(),
    },
  },
}));

import { cloudinary } from "@/lib/cloudinary";
import { registerLecturerCv, MAX_CV_BYTES } from "../lecturer-cv";

function makeDb(overrides: Partial<Record<string, unknown>> = {}) {
  const profile = { id: "profile-1", userId: "user-1", fullName: "Jane Doe", cvDownloadId: null };
  const db = {
    lecturerProfile: {
      findUniqueOrThrow: vi.fn(async () => profile),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...profile, ...data })),
    },
    download: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: "download-1", ...data })),
      findUnique: vi.fn(async () => null),
      delete: vi.fn(async () => {}),
    },
    auditLog: { create: vi.fn(async () => {}) },
    ...overrides,
  };
  return { ...db, $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(db)) } as never;
}

describe("registerLecturerCv", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200 })));
  });

  it("rejects a publicId outside the caller's own CV folder", async () => {
    const db = makeDb();
    await expect(
      registerLecturerCv(db, "user-1", { publicId: "oau-maths/lecturers/cv/someone-elses-profile/x", actorId: "user-1" }),
    ).rejects.toThrow(/folder/i);
    expect(cloudinary.api.resource).not.toHaveBeenCalled();
  });

  it("registers a valid PDF under the size cap", async () => {
    vi.mocked(cloudinary.api.resource).mockResolvedValue({
      secure_url: "https://res.cloudinary.com/x/image/upload/v1/oau-maths/lecturers/cv/profile-1/cv.pdf",
      bytes: 1_000_000,
      format: "pdf",
    } as never);
    const db = makeDb();

    const result = await registerLecturerCv(db, "user-1", {
      publicId: "oau-maths/lecturers/cv/profile-1/cv",
      actorId: "user-1",
    });

    expect(result.filename).toBe("Doe-CV.pdf");
    expect(cloudinary.api.delete_resources).not.toHaveBeenCalled();
  });

  it("rejects and deletes a file over the size cap", async () => {
    vi.mocked(cloudinary.api.resource).mockResolvedValue({
      secure_url: "https://res.cloudinary.com/x/image/upload/v1/oau-maths/lecturers/cv/profile-1/cv.pdf",
      bytes: MAX_CV_BYTES + 1,
      format: "pdf",
    } as never);
    const db = makeDb();

    await expect(
      registerLecturerCv(db, "user-1", { publicId: "oau-maths/lecturers/cv/profile-1/cv", actorId: "user-1" }),
    ).rejects.toThrow(/size|large|MB/i);
    expect(cloudinary.api.delete_resources).toHaveBeenCalledWith(
      ["oau-maths/lecturers/cv/profile-1/cv"],
      expect.objectContaining({ resource_type: "image" }),
    );
  });

  it("rejects and deletes a file that is not actually a PDF", async () => {
    vi.mocked(cloudinary.api.resource).mockResolvedValue({
      secure_url: "https://res.cloudinary.com/x/image/upload/v1/oau-maths/lecturers/cv/profile-1/cv.jpg",
      bytes: 1000,
      format: "jpg",
    } as never);
    const db = makeDb();

    await expect(
      registerLecturerCv(db, "user-1", { publicId: "oau-maths/lecturers/cv/profile-1/cv", actorId: "user-1" }),
    ).rejects.toThrow(/pdf/i);
    expect(cloudinary.api.delete_resources).toHaveBeenCalled();
  });

  it("surfaces a clear, admin-readable error when Cloudinary blocks PDF delivery (401)", async () => {
    vi.mocked(cloudinary.api.resource).mockResolvedValue({
      secure_url: "https://res.cloudinary.com/x/image/upload/v1/oau-maths/lecturers/cv/profile-1/cv.pdf",
      bytes: 1000,
      format: "pdf",
    } as never);
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 401 })));
    const db = makeDb();

    await expect(
      registerLecturerCv(db, "user-1", { publicId: "oau-maths/lecturers/cv/profile-1/cv", actorId: "user-1" }),
    ).rejects.toThrow(/Allow delivery of PDF and ZIP files/i);
  });
});
