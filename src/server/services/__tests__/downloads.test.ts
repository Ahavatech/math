import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/cloudinary", () => ({
  cloudinary: {
    api: { resource: vi.fn(), delete_resources: vi.fn() },
  },
  ALLOWED_IMAGE_FORMATS: ["jpg", "jpeg", "png", "webp", "avif"],
  MAX_UPLOAD_BYTES: 10 * 1024 * 1024,
}));

import { cloudinary } from "@/lib/cloudinary";
import { registerDownload, replaceDownloadFile } from "../downloads";

function makeDb(overrides: Record<string, unknown> = {}) {
  const db = {
    download: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: "download-1", ...data })),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: "download-1", filePublicId: "old-public-id", ...data })),
      findUniqueOrThrow: vi.fn(async () => ({ id: "download-1", filePublicId: "old-public-id" })),
      aggregate: vi.fn(async () => ({ _max: { order: null } })),
      ...overrides,
    },
    auditLog: {
      create: vi.fn(async () => ({})),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(db)),
  };
  return db as never;
}

describe("registerDownload", () => {
  beforeEach(() => vi.clearAllMocks());

  it("verifies the uploaded resource is a PDF under the expected size", async () => {
    vi.mocked(cloudinary.api.resource).mockResolvedValue({
      secure_url: "https://res.cloudinary.com/demo/image/upload/v1/oau-maths/downloads/x.pdf",
      format: "pdf",
      bytes: 100_000,
    } as never);

    const db = makeDb();
    const result = await registerDownload(db, {
      publicId: "oau-maths/downloads/x",
      title: "Admission Form",
      description: "",
      category: "FORM",
      status: "DRAFT",
      actorId: "actor-1",
    });

    expect(result.fileUrl).toContain("x.pdf");
    expect(cloudinary.api.resource).toHaveBeenCalledWith("oau-maths/downloads/x", expect.objectContaining({ resource_type: "image" }));
  });

  it("rejects a publicId outside the downloads folder", async () => {
    const db = makeDb();
    await expect(
      registerDownload(db, { publicId: "oau-maths/other/x", title: "x", description: "", category: "FORM", status: "DRAFT", actorId: "a" }),
    ).rejects.toThrow(/folder/i);
    expect(cloudinary.api.resource).not.toHaveBeenCalled();
  });

  it("rejects a non-PDF upload and deletes it from Cloudinary", async () => {
    vi.mocked(cloudinary.api.resource).mockResolvedValue({ secure_url: "x", format: "jpg", bytes: 1000 } as never);
    const db = makeDb();
    await expect(
      registerDownload(db, { publicId: "oau-maths/downloads/x", title: "x", description: "", category: "FORM", status: "DRAFT", actorId: "a" }),
    ).rejects.toThrow(/pdf/i);
    expect(cloudinary.api.delete_resources).toHaveBeenCalled();
  });
});

describe("replaceDownloadFile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("removes the old Cloudinary asset after registering the new one", async () => {
    vi.mocked(cloudinary.api.resource).mockResolvedValue({
      secure_url: "https://res.cloudinary.com/demo/image/upload/v1/oau-maths/downloads/new.pdf",
      format: "pdf",
      bytes: 50_000,
    } as never);
    const db = makeDb();

    await replaceDownloadFile(db, "download-1", "oau-maths/downloads/new");

    expect(cloudinary.api.delete_resources).toHaveBeenCalledWith(["old-public-id"], expect.objectContaining({ resource_type: "image" }));
  });
});
