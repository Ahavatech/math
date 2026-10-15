import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/cloudinary", () => ({
  cloudinary: {
    api: {
      resource: vi.fn(),
      delete_resources: vi.fn(),
    },
  },
  ALLOWED_IMAGE_FORMATS: ["jpg", "jpeg", "png", "webp", "avif"],
  MAX_UPLOAD_BYTES: 10 * 1024 * 1024,
}));

import { cloudinary } from "@/lib/cloudinary";
import { registerMediaAsset } from "../media";

function makeDb() {
  return {
    mediaAsset: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: "asset-1",
        ...data,
      })),
    },
  } as never;
}

describe("registerMediaAsset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("re-fetches the resource from Cloudinary and uses its dimensions, never a client-supplied value", async () => {
    vi.mocked(cloudinary.api.resource).mockResolvedValue({
      secure_url: "https://res.cloudinary.com/demo/image/upload/v1/oau-maths/lecturers/x.jpg",
      width: 800,
      height: 600,
      bytes: 123456,
      format: "jpg",
    } as never);

    const db = makeDb();
    const asset = await registerMediaAsset(db, {
      publicId: "oau-maths/lecturers/x",
      alt: "A lecturer's portrait",
      uploadedById: "user-1",
      folder: "lecturers",
    });

    expect(cloudinary.api.resource).toHaveBeenCalledWith(
      "oau-maths/lecturers/x",
      expect.objectContaining({ resource_type: "image" }),
    );
    expect(asset).toMatchObject({
      width: 800,
      height: 600,
      bytes: 123456,
      format: "jpg",
      url: "https://res.cloudinary.com/demo/image/upload/v1/oau-maths/lecturers/x.jpg",
      alt: "A lecturer's portrait",
      provider: "cloudinary",
      publicId: "oau-maths/lecturers/x",
      uploadedById: "user-1",
    });
  });

  it("rejects an empty alt text", async () => {
    const db = makeDb();
    await expect(
      registerMediaAsset(db, { publicId: "oau-maths/site/x", alt: "", uploadedById: null, folder: "site" }),
    ).rejects.toThrow(/alt/i);
    expect(cloudinary.api.resource).not.toHaveBeenCalled();
  });

  it("rejects a publicId outside the claimed folder", async () => {
    const db = makeDb();
    await expect(
      registerMediaAsset(db, { publicId: "other-app/x", alt: "ok", uploadedById: null, folder: "site" }),
    ).rejects.toThrow(/folder/i);
    expect(cloudinary.api.resource).not.toHaveBeenCalled();
  });

  it("rejects a publicId that lives in a different folder than the one the caller was authorized for", async () => {
    const db = makeDb();
    await expect(
      registerMediaAsset(db, {
        publicId: "oau-maths/site/logo",
        alt: "ok",
        uploadedById: null,
        folder: "news",
      }),
    ).rejects.toThrow(/folder/i);
    expect(cloudinary.api.resource).not.toHaveBeenCalled();
  });

  it("propagates a Cloudinary lookup failure instead of registering a row from nothing", async () => {
    vi.mocked(cloudinary.api.resource).mockRejectedValue(new Error("not found"));
    const db = makeDb();
    await expect(
      registerMediaAsset(db, { publicId: "oau-maths/site/x", alt: "ok", uploadedById: null, folder: "site" }),
    ).rejects.toThrow("not found");
    expect((db as { mediaAsset: { create: ReturnType<typeof vi.fn> } }).mediaAsset.create).not.toHaveBeenCalled();
  });
});
