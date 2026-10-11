import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/cloudinary", () => ({
  cloudinary: {
    api: {
      resource: vi.fn(),
      delete_resources: vi.fn(),
    },
    uploader: {
      rename: vi.fn(),
    },
    url: vi.fn(),
  },
  ALLOWED_IMAGE_FORMATS: ["jpg", "jpeg", "png", "webp", "avif"],
  MAX_UPLOAD_BYTES: 10 * 1024 * 1024,
}));

import { cloudinary } from "@/lib/cloudinary";
import {
  registerPendingAlumniPhoto,
  publishAlumniPhoto,
  deleteAlumniPhoto,
  getSignedAlumniPhotoUrl,
} from "../alumni-photos";

function makeDb(overrides: Record<string, unknown> = {}) {
  return {
    mediaAsset: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: "photo-1", ...data })),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: "photo-1",
        publicId: "oau-maths/alumni/pending/x",
        deliveryType: "authenticated",
        ...data,
      })),
      findUniqueOrThrow: vi.fn(async () => ({
        id: "photo-1",
        publicId: "oau-maths/alumni/pending/x",
        deliveryType: "authenticated",
      })),
      delete: vi.fn(async () => ({})),
      ...overrides,
    },
  } as never;
}

describe("registerPendingAlumniPhoto", () => {
  beforeEach(() => vi.clearAllMocks());

  it("verifies the resource is authenticated, under the pending folder, and an allowed format", async () => {
    vi.mocked(cloudinary.api.resource).mockResolvedValue({
      secure_url: "https://res.cloudinary.com/demo/image/authenticated/s--sig--/v1/oau-maths/alumni/pending/x.jpg",
      width: 600,
      height: 600,
      bytes: 90000,
      format: "jpg",
      type: "authenticated",
    } as never);

    const db = makeDb();
    const asset = await registerPendingAlumniPhoto(db, { publicId: "oau-maths/alumni/pending/x" });

    expect(asset).toMatchObject({ deliveryType: "authenticated" });
    expect(cloudinary.api.resource).toHaveBeenCalledWith(
      "oau-maths/alumni/pending/x",
      expect.objectContaining({ resource_type: "image", type: "authenticated" }),
    );
  });

  it("rejects a publicId outside oau-maths/alumni/pending", async () => {
    const db = makeDb();
    await expect(
      registerPendingAlumniPhoto(db, { publicId: "oau-maths/alumni/x" }),
    ).rejects.toThrow(/folder/i);
    expect(cloudinary.api.resource).not.toHaveBeenCalled();
  });

  it("rejects a resource whose actual delivery type is not authenticated", async () => {
    vi.mocked(cloudinary.api.resource).mockResolvedValue({
      secure_url: "https://res.cloudinary.com/demo/image/upload/v1/oau-maths/alumni/pending/x.jpg",
      width: 600,
      height: 600,
      bytes: 90000,
      format: "jpg",
      type: "upload",
    } as never);
    const db = makeDb();
    await expect(
      registerPendingAlumniPhoto(db, { publicId: "oau-maths/alumni/pending/x" }),
    ).rejects.toThrow(/authenticated/i);
  });
});

describe("publishAlumniPhoto", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renames the asset from authenticated to upload and updates deliveryType/url", async () => {
    vi.mocked(cloudinary.uploader.rename).mockResolvedValue({
      secure_url: "https://res.cloudinary.com/demo/image/upload/v1/oau-maths/alumni/pending/x.jpg",
    } as never);
    const db = makeDb();

    await publishAlumniPhoto(db, "photo-1");

    expect(cloudinary.uploader.rename).toHaveBeenCalledWith(
      "oau-maths/alumni/pending/x",
      "oau-maths/alumni/pending/x",
      expect.objectContaining({ type: "authenticated", to_type: "upload", resource_type: "image" }),
    );
    expect((db as never as { mediaAsset: { update: ReturnType<typeof vi.fn> } }).mediaAsset.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "photo-1" },
        data: expect.objectContaining({ deliveryType: "upload" }),
      }),
    );
  });
});

describe("deleteAlumniPhoto", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes the Cloudinary resource using the asset's current deliveryType as `type`, then removes the row", async () => {
    const db = makeDb();
    await deleteAlumniPhoto(db, "photo-1");

    expect(cloudinary.api.delete_resources).toHaveBeenCalledWith(
      ["oau-maths/alumni/pending/x"],
      expect.objectContaining({ resource_type: "image", type: "authenticated" }),
    );
    expect((db as never as { mediaAsset: { delete: ReturnType<typeof vi.fn> } }).mediaAsset.delete).toHaveBeenCalledWith({
      where: { id: "photo-1" },
    });
  });
});

describe("getSignedAlumniPhotoUrl", () => {
  it("returns null since no time-limited signed delivery is available on this plan (see docs/MEDIA.md)", () => {
    expect(getSignedAlumniPhotoUrl("oau-maths/alumni/pending/x")).toBeNull();
  });
});
