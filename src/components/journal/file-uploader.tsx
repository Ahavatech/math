"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type Props = {
  manuscriptId: string;
  /** ManuscriptFileKind the file is stored as, e.g. MANUSCRIPT or REVISED. */
  kind: string;
  label: string;
  accept?: string;
  /** Name of the file already uploaded, if any. */
  currentName?: string | null;
};

const MAX_BYTES = 25 * 1024 * 1024;

/**
 * Sends one file to the private upload endpoint as a raw body with the headers
 * the endpoint requires, then refreshes the page so the server shows the result.
 */
export function FileUploader({ manuscriptId, kind, label, accept = ".pdf,.docx", currentName }: Props) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "ok"; text: string } | null>(null);

  async function upload() {
    const file = input.current?.files?.[0];
    if (!file) {
      setMessage({ kind: "error", text: "Choose a file first." });
      return;
    }
    if (file.size > MAX_BYTES) {
      setMessage({ kind: "error", text: "That file is larger than 25 MB." });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/journal/manuscripts/${manuscriptId}/files`, {
        method: "POST",
        headers: {
          "X-File-Kind": kind,
          "X-File-Name": encodeURIComponent(file.name),
          "X-Requested-With": "fetch",
          "Content-Type": file.type || "application/octet-stream",
        },
        body: file,
      });
      if (!res.ok) {
        const reason =
          res.status === 429
            ? "Too many uploads just now. Wait a minute and try again."
            : res.status === 422
              ? (await res.text()) || "That file was not accepted."
              : "The upload failed. Please try again.";
        setMessage({ kind: "error", text: reason });
        return;
      }
      const result = (await res.json()) as { metadataWarning?: string | null };
      setMessage({
        kind: "ok",
        text: result.metadataWarning ? `Uploaded. ${result.metadataWarning}` : "Uploaded.",
      });
      if (input.current) input.current.value = "";
      router.refresh();
    } catch {
      setMessage({ kind: "error", text: "The upload failed. Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  const id = `upload-${kind.toLowerCase()}`;
  return (
    <div className="mt-3">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {currentName ? (
        <p className="text-muted-foreground mt-1 text-sm">Uploaded: {currentName}</p>
      ) : (
        <p className="text-muted-foreground mt-1 text-sm">Nothing uploaded yet.</p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <input ref={input} id={id} type="file" accept={accept} className="min-w-0 text-sm" />
        <Button type="button" variant="outline" size="sm" onClick={upload} disabled={busy}>
          {busy ? "Uploading..." : currentName ? "Replace file" : "Upload file"}
        </Button>
      </div>
      {message ? (
        <p
          role={message.kind === "error" ? "alert" : "status"}
          className={message.kind === "error" ? "mt-2 text-sm text-destructive" : "mt-2 text-sm text-muted-foreground"}
        >
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
