"use client";

import { useRef, useState, useTransition } from "react";
import type { Download } from "@prisma/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { registerLecturerCvAction } from "@/server/actions/lecturers";

const MAX_CV_BYTES = 5 * 1024 * 1024;

async function uploadCvToCloudinary(file: File): Promise<{ publicId: string }> {
  const signRes = await fetch("/api/lecturer-cv-signing", { method: "POST" });
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

export function CvUpload({ cvDownload }: { cvDownload: Download | null }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    if (file.type !== "application/pdf") {
      setError("Please choose a PDF file.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    if (file.size > MAX_CV_BYTES) {
      setError("The file is larger than 5 MB.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    startTransition(async () => {
      try {
        const { publicId } = await uploadCvToCloudinary(file);
        const fd = new FormData();
        fd.set("publicId", publicId);
        const result = await registerLecturerCvAction(fd);
        if (result.error) {
          setError(result.error);
          return;
        }
        window.location.reload();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        if (inputRef.current) inputRef.current.value = "";
      }
    });
  }

  return (
    <div className="space-y-2">
      <Label>CV (PDF, max 5 MB)</Label>
      {cvDownload?.fileUrl ? (
        <p className="text-sm">
          Current file:{" "}
          <a href={cvDownload.fileUrl} target="_blank" rel="noopener noreferrer" className="underline">
            {cvDownload.title}
          </a>
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">No CV uploaded yet.</p>
      )}
      <Input ref={inputRef} type="file" accept="application/pdf" disabled={pending} onChange={handleChange} />
      {pending ? <p className="text-xs text-muted-foreground">Uploading...</p> : null}
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
