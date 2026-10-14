"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ADMIN_DOWNLOAD_CATEGORIES } from "@/lib/validators/download";
import { registerDownloadAction } from "@/server/actions/downloads";

const MAX_BYTES = 10 * 1024 * 1024;

async function uploadToCloudinary(file: File): Promise<{ publicId: string }> {
  const signRes = await fetch("/api/downloads-signing", { method: "POST" });
  if (!signRes.ok) {
    const detail = await signRes.json().catch(() => null);
    throw new Error(detail?.error ?? "Could not get upload permission");
  }
  const sign = await signRes.json();

  const body = new FormData();
  body.set("file", file);
  body.set("api_key", sign.apiKey);
  body.set("timestamp", String(sign.timestamp));
  body.set("signature", sign.signature);
  body.set("folder", sign.folder);
  body.set("allowed_formats", "pdf");

  const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${sign.cloudName}/image/upload`, { method: "POST", body });
  if (!uploadRes.ok) {
    const detail = await uploadRes.json().catch(() => null);
    throw new Error(detail?.error?.message ?? "Upload failed");
  }
  const result = await uploadRes.json();
  return { publicId: result.public_id };
}

export function UploadForm() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<(typeof ADMIN_DOWNLOAD_CATEGORIES)[number]>("FORM");
  const [status, setStatus] = useState("DRAFT");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function upload() {
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setError("Choose a PDF file first");
      return;
    }
    if (file.type !== "application/pdf") {
      setError("Please choose a PDF file");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("The file is larger than 10MB");
      return;
    }
    if (!title.trim()) {
      setError("A title is required");
      return;
    }
    setError(null);

    startTransition(async () => {
      try {
        const { publicId } = await uploadToCloudinary(file);
        const fd = new FormData();
        fd.set("publicId", publicId);
        fd.set("title", title);
        fd.set("description", description);
        fd.set("category", category);
        fd.set("status", status);
        const result = await registerDownloadAction(fd);
        if (result.error) {
          setError(result.error);
          return;
        }
        window.location.reload();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      }
    });
  }

  return (
    <div className="space-y-3 rounded-md border border-border p-4">
      <h2 className="font-medium">Upload a file</h2>
      <div className="space-y-1.5">
        <Label htmlFor="dl-title">Title</Label>
        <Input id="dl-title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="dl-description">Description</Label>
        <Input id="dl-description" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <select value={category} onChange={(e) => setCategory(e.target.value as typeof category)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          {ADMIN_DOWNLOAD_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
        </select>
      </div>
      <Input ref={inputRef} type="file" accept="application/pdf" />
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="button" onClick={upload} disabled={pending}>
        {pending ? "Uploading..." : "Upload"}
      </Button>
    </div>
  );
}
