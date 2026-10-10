"use client";

import { useRef, useState, useTransition } from "react";
import type { MediaAsset } from "@prisma/client";
import { CloudImage } from "@/components/ui/cloud-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ImageCropDialog } from "./image-crop-dialog";
import { registerMediaAction } from "@/server/actions/media";
import type { MediaFolder } from "@/lib/media-folders";

type SelectedMedia = { id: string; url: string; alt: string };

async function uploadToCloudinary(
  file: File,
  folder: MediaFolder,
): Promise<{ publicId: string }> {
  const signRes = await fetch("/api/upload-signing", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folder }),
  });
  if (!signRes.ok) {
    throw new Error("Could not get upload permission");
  }
  const sign = await signRes.json();

  const body = new FormData();
  body.set("file", file);
  body.set("api_key", sign.apiKey);
  body.set("timestamp", String(sign.timestamp));
  body.set("signature", sign.signature);
  body.set("folder", sign.folder);
  body.set("allowed_formats", sign.allowedFormats.join(","));

  const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${sign.cloudName}/image/upload`, {
    method: "POST",
    body,
  });
  if (!uploadRes.ok) {
    const detail = await uploadRes.json().catch(() => null);
    throw new Error(detail?.error?.message ?? "Upload failed");
  }
  const result = await uploadRes.json();
  return { publicId: result.public_id };
}

export function MediaPicker({
  folder,
  existing,
  value,
  onChange,
  label = "Image",
}: {
  folder: MediaFolder;
  existing: MediaAsset[];
  value: SelectedMedia | null;
  onChange: (media: SelectedMedia | null) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [alt, setAlt] = useState("");
  const [cropping, setCropping] = useState(false);
  const [sizeInfo, setSizeInfo] = useState<{ before: number; after: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setError(null);

    const { compressImage } = await import("@/components/admin/image-compress");
    try {
      const { file: compressed, originalBytes, compressedBytes } = await compressImage(selected);
      setFile(compressed);
      setPreviewUrl(URL.createObjectURL(compressed));
      setSizeInfo({ before: originalBytes, after: compressedBytes });
    } catch {
      setError("Could not process that image");
    }
  }

  function handleUpload() {
    if (!file || !alt.trim()) {
      setError("Choose a file and enter alt text first");
      return;
    }
    setError(null);

    startTransition(async () => {
      try {
        const { publicId } = await uploadToCloudinary(file, folder);
        const formData = new FormData();
        formData.set("publicId", publicId);
        formData.set("alt", alt);
        formData.set("folder", folder);
        const result = await registerMediaAction(undefined, formData);
        if (result.error || !result.mediaId) {
          setError(result.error ?? "Could not save upload");
          return;
        }
        onChange({ id: result.mediaId, url: previewUrl ?? "", alt });
        setOpen(false);
        resetUploadState();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      }
    });
  }

  function resetUploadState() {
    setFile(null);
    setPreviewUrl(null);
    setAlt("");
    setSizeInfo(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {value ? (
        <div className="flex items-center gap-3">
          <CloudImage src={value.url} alt={value.alt} width={120} height={80} className="rounded-md border border-border object-cover" />
          <Button type="button" variant="outline" size="sm" onClick={() => onChange(null)}>
            Remove
          </Button>
        </div>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button type="button" variant="outline" size="sm">{value ? "Change image" : "Choose or upload"}</Button>} />
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Choose an image</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="media-file">Upload a new image</Label>
              <Input id="media-file" ref={inputRef} type="file" accept="image/*" onChange={handleFileChange} />
              {sizeInfo ? (
                <p className="text-xs text-muted-foreground">
                  {(sizeInfo.before / 1024).toFixed(0)} KB -&gt; {(sizeInfo.after / 1024).toFixed(0)} KB after compression
                </p>
              ) : null}
              {previewUrl ? (
                <div className="flex items-center gap-3">
                  <img src={previewUrl} alt="" className="h-20 w-28 rounded-md border border-border object-cover" />
                  <Button type="button" size="sm" variant="outline" onClick={() => setCropping(true)}>
                    Crop
                  </Button>
                </div>
              ) : null}
              <div className="space-y-1.5">
                <Label htmlFor="media-alt">Alt text (required)</Label>
                <Input id="media-alt" value={alt} onChange={(e) => setAlt(e.target.value)} required />
              </div>
              {error ? (
                <p className="text-destructive text-sm" role="alert">
                  {error}
                </p>
              ) : null}
              <Button type="button" onClick={handleUpload} disabled={pending || !file}>
                {pending ? "Uploading..." : "Upload and use"}
              </Button>
            </div>

            {existing.length > 0 ? (
              <div className="space-y-2 border-t border-border pt-4">
                <Label>Or pick an existing image</Label>
                <div className="grid grid-cols-4 gap-2">
                  {existing.map((asset) => (
                    <button
                      key={asset.id}
                      type="button"
                      className="overflow-hidden rounded-md border border-border hover:border-primary"
                      onClick={() => {
                        onChange({ id: asset.id, url: asset.url, alt: asset.alt ?? "" });
                        setOpen(false);
                      }}
                    >
                      <CloudImage src={asset.url} alt={asset.alt ?? ""} width={120} height={80} className="h-20 w-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {previewUrl ? (
        <ImageCropDialog
          open={cropping}
          imageUrl={previewUrl}
          fileName={file?.name ?? "image.webp"}
          onCancel={() => setCropping(false)}
          onCropped={(cropped) => {
            setFile(cropped);
            setPreviewUrl(URL.createObjectURL(cropped));
            setCropping(false);
          }}
        />
      ) : null}
    </div>
  );
}
