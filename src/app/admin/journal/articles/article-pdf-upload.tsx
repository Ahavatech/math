"use client";

import { useRef, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { registerArticlePdfAction } from "@/server/actions/journal-articles";

const MAX_BYTES = 10 * 1024 * 1024;

async function uploadPdf(file: File) {
  const signRes = await fetch("/api/journal-article-pdf-signing", { method: "POST" });
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
  return { publicId: result.public_id as string };
}

export function ArticlePdfUpload({ articleId, hasPdf }: { articleId: string; hasPdf: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setSuccess(false);

    if (file.type !== "application/pdf") {
      setError("Please choose a PDF file.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("The file is larger than 10 MB.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    startTransition(async () => {
      try {
        const { publicId } = await uploadPdf(file);
        const result = await registerArticlePdfAction(articleId, publicId);
        if (result.error) {
          setError(result.error);
          return;
        }
        setSuccess(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        if (inputRef.current) inputRef.current.value = "";
      }
    });
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor="pdf-upload">PDF {hasPdf ? "(replace)" : ""}</Label>
      <Input id="pdf-upload" ref={inputRef} type="file" accept="application/pdf" onChange={handleChange} disabled={pending} />
      {pending ? <p className="text-sm text-muted-foreground">Uploading...</p> : null}
      {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
      {success ? <Alert><AlertDescription>PDF uploaded.</AlertDescription></Alert> : null}
      {hasPdf && !success ? <p className="text-sm text-muted-foreground">A PDF is already uploaded.</p> : null}
    </div>
  );
}
