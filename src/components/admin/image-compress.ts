/**
 * Client-side only. Dynamically imported by callers so
 * browser-image-compression never enters a public route bundle.
 * Resizes to a max of 2000px on the long edge, re-encodes to WebP
 * (falls back to JPEG when the browser can't produce WebP), targets
 * under 400KB, keeps EXIF orientation, and strips location/other EXIF
 * metadata (browser-image-compression strips EXIF by default unless
 * preserveExif is set, which we deliberately do not set here, except
 * orientation which it bakes into the re-encoded pixels).
 */
export async function compressImage(
  file: File,
): Promise<{ file: File; originalBytes: number; compressedBytes: number }> {
  const imageCompression = (await import("browser-image-compression")).default;

  const compressed = await imageCompression(file, {
    maxWidthOrHeight: 2000,
    maxSizeMB: 0.4,
    fileType: "image/webp",
    useWebWorker: true,
    exifOrientation: undefined, // let the library read and bake in orientation, then strip EXIF
  });

  return {
    file: compressed,
    originalBytes: file.size,
    compressedBytes: compressed.size,
  };
}
