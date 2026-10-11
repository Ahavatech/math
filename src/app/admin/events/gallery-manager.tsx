"use client";

import { useRef, useState, useTransition } from "react";
import type { EventGalleryImage, MediaAsset } from "@prisma/client";
import { CloudImage } from "@/components/ui/cloud-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowUp, ArrowDown } from "lucide-react";
import { registerMediaAction } from "@/server/actions/media";
import { addGalleryImageAction, removeGalleryImageAction, reorderGalleryImageAction } from "@/server/actions/events";

const MAX_IMAGES = 30;

async function uploadToCloudinary(file: File): Promise<{ publicId: string }> {
  const signRes = await fetch("/api/upload-signing", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folder: "events" }),
  });
  if (!signRes.ok) throw new Error("Could not get upload permission");
  const sign = await signRes.json();

  const body = new FormData();
  body.set("file", file);
  body.set("api_key", sign.apiKey);
  body.set("timestamp", String(sign.timestamp));
  body.set("signature", sign.signature);
  body.set("folder", sign.folder);
  body.set("allowed_formats", sign.allowedFormats.join(","));

  const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${sign.cloudName}/image/upload`, { method: "POST", body });
  if (!uploadRes.ok) {
    const detail = await uploadRes.json().catch(() => null);
    throw new Error(detail?.error?.message ?? "Upload failed");
  }
  const result = await uploadRes.json();
  return { publicId: result.public_id };
}

type GalleryItem = EventGalleryImage & { media: MediaAsset };

export function GalleryManager({ eventId, images }: { eventId: string; images: GalleryItem[] }) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [alt, setAlt] = useState("");
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setError(null);
    const { compressImage } = await import("@/components/admin/image-compress");
    try {
      const { file: compressed } = await compressImage(selected);
      setFile(compressed);
      setPreviewUrl(URL.createObjectURL(compressed));
    } catch {
      setError("Could not process that image");
    }
  }

  function addImage() {
    if (!file || !alt.trim() || !caption.trim()) {
      setError("Choose a file, and fill in both alt text and a caption first");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const { publicId } = await uploadToCloudinary(file);
        const mediaForm = new FormData();
        mediaForm.set("publicId", publicId);
        mediaForm.set("alt", alt);
        mediaForm.set("folder", "events");
        const mediaResult = await registerMediaAction(undefined, mediaForm);
        if (mediaResult.error || !mediaResult.mediaId) {
          setError(mediaResult.error ?? "Could not save upload");
          return;
        }

        const galleryForm = new FormData();
        galleryForm.set("eventId", eventId);
        galleryForm.set("mediaId", mediaResult.mediaId);
        galleryForm.set("caption", caption);
        const galleryResult = await addGalleryImageAction(galleryForm);
        if (galleryResult.error) {
          setError(galleryResult.error);
          return;
        }

        setFile(null);
        setPreviewUrl(null);
        setAlt("");
        setCaption("");
        if (inputRef.current) inputRef.current.value = "";
        window.location.reload();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", id);
      fd.set("eventId", eventId);
      await removeGalleryImageAction(fd);
      window.location.reload();
    });
  }

  function move(id: string, direction: "up" | "down") {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", id);
      fd.set("eventId", eventId);
      fd.set("direction", direction);
      await reorderGalleryImageAction(fd);
      window.location.reload();
    });
  }

  return (
    <div className="space-y-4">
      <h2 className="font-heading text-base font-semibold">Gallery ({images.length}/{MAX_IMAGES})</h2>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {images.map((img, i) => (
          <li key={img.id} className="space-y-1 rounded-md border border-border p-2">
            <CloudImage src={img.media.url} alt={img.media.alt ?? ""} width={160} height={110} className="w-full rounded-md object-cover" />
            <p className="truncate text-xs text-muted-foreground">{img.caption}</p>
            <div className="flex items-center justify-between">
              <div className="flex gap-1">
                <Button type="button" size="icon" variant="ghost" disabled={pending || i === 0} onClick={() => move(img.id, "up")}>
                  <ArrowUp className="size-4" />
                </Button>
                <Button type="button" size="icon" variant="ghost" disabled={pending || i === images.length - 1} onClick={() => move(img.id, "down")}>
                  <ArrowDown className="size-4" />
                </Button>
              </div>
              <Button type="button" size="sm" variant="destructive" disabled={pending} onClick={() => remove(img.id)}>
                Remove
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {images.length < MAX_IMAGES ? (
        <div className="space-y-2 rounded-md border border-border p-3">
          <Label htmlFor="gallery-file">Add an image</Label>
          <Input id="gallery-file" ref={inputRef} type="file" accept="image/*" onChange={handleFileChange} />
          {previewUrl ? <img src={previewUrl} alt="" className="h-24 w-32 rounded-md border border-border object-cover" /> : null}
          <div className="space-y-1.5">
            <Label htmlFor="gallery-alt">Alt text (required)</Label>
            <Input id="gallery-alt" value={alt} onChange={(e) => setAlt(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gallery-caption">Caption (required)</Label>
            <Input id="gallery-caption" value={caption} onChange={(e) => setCaption(e.target.value)} />
          </div>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <Button type="button" onClick={addImage} disabled={pending || !file}>
            {pending ? "Adding..." : "Add to gallery"}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Gallery is at the 30-image limit.</p>
      )}
    </div>
  );
}
