"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { COUNTRIES } from "@/lib/countries";
import { INDUSTRIES } from "@/lib/industries";
import { ALUMNI_CONSENT_V1 } from "@/lib/alumni-consent";

type ActionResult = { error?: string; success?: boolean };
type BoundAction = (prevState: ActionResult | undefined, formData: FormData) => Promise<ActionResult>;

const currentYear = new Date().getFullYear();

async function uploadAlumniPhoto(file: File, token: string): Promise<string> {
  const { compressImage } = await import("@/components/admin/image-compress");
  const { file: compressed } = await compressImage(file, { maxWidthOrHeight: 1200, maxSizeMB: 0.3 });

  const signRes = await fetch("/api/alumni-upload-signing", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  if (!signRes.ok) {
    throw new Error("Could not get upload permission");
  }
  const sign = await signRes.json();

  const body = new FormData();
  body.set("file", compressed);
  body.set("api_key", sign.apiKey);
  body.set("timestamp", String(sign.timestamp));
  body.set("signature", sign.signature);
  body.set("folder", sign.folder);
  body.set("type", sign.type);
  body.set("allowed_formats", sign.allowedFormats.join(","));

  const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${sign.cloudName}/image/upload`, {
    method: "POST",
    body,
  });
  if (!uploadRes.ok) {
    const detail = await uploadRes.json().catch(() => null);
    throw new Error(detail?.error?.message ?? "Photo upload failed");
  }
  const result = await uploadRes.json();
  return result.public_id as string;
}

export function SubmitForm({
  action,
  token,
  formToken,
  formRenderedAt,
  cohortYear,
}: {
  action: BoundAction;
  token: string;
  formToken: string;
  formRenderedAt: number;
  cohortYear: number | null;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [photoPublicId, setPhotoPublicId] = useState("");
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (state?.success) {
    return (
      <p className="mt-6 text-sm">
        Thank you. Your details were received and will appear after the department has checked them.
      </p>
    );
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError(null);
    setPhotoUploading(true);
    try {
      const publicId = await uploadAlumniPhoto(file, token);
      setPhotoPublicId(publicId);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Could not upload photo");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } finally {
      setPhotoUploading(false);
    }
  }

  return (
    <form action={formAction} className="mt-6 space-y-5">
      <input type="hidden" name="formToken" value={formToken} />
      <input type="hidden" name="formRenderedAt" value={formRenderedAt} />
      <input type="hidden" name="photoPublicId" value={photoPublicId} />

      {/* Honeypot: hidden from sighted users, left in the tab order for bots that fill every field. A genuine submitter never sees or fills this. */}
      <div style={{ position: "absolute", left: "-9999px", top: "-9999px" }} aria-hidden="true">
        <label htmlFor="website">Leave this field empty</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="fullName">Full name</Label>
        <Input id="fullName" name="fullName" required maxLength={120} className="h-11" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">Email (never shown publicly)</Label>
        <Input id="email" name="email" type="email" required maxLength={254} className="h-11" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="level">Level</Label>
          <select id="level" name="level" required className="h-11 w-full rounded-md border border-input bg-background px-2 text-sm">
            <option value="BSC">B.Sc.</option>
            <option value="MSC">M.Sc.</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="graduationYear">Graduation year</Label>
          <Input
            id="graduationYear"
            name="graduationYear"
            type="number"
            min={1965}
            max={currentYear}
            defaultValue={cohortYear ?? undefined}
            required
            className="h-11"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="organisation">Current organisation</Label>
        <Input id="organisation" name="organisation" maxLength={120} className="h-11" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="roleTitle">Role or title</Label>
        <Input id="roleTitle" name="roleTitle" maxLength={120} className="h-11" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="city">City</Label>
        <Input id="city" name="city" maxLength={120} className="h-11" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="country">Country</Label>
          <select id="country" name="country" className="h-11 w-full rounded-md border border-input bg-background px-2 text-sm">
            <option value="">Select</option>
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="industry">Industry</Label>
          <select id="industry" name="industry" className="h-11 w-full rounded-md border border-input bg-background px-2 text-sm">
            <option value="">Select</option>
            {INDUSTRIES.map((i) => (
              <option key={i} value={i}>{i}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="photo">Photo (optional)</Label>
        <input
          ref={fileInputRef}
          id="photo"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          onChange={handlePhotoChange}
          className="block w-full text-sm"
        />
        {photoUploading ? <p className="text-xs text-muted-foreground">Uploading...</p> : null}
        {photoPublicId ? <p className="text-xs text-muted-foreground">Photo attached.</p> : null}
        {photoError ? <p className="text-xs text-destructive">{photoError}</p> : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="linkedinUrl">LinkedIn URL (optional)</Label>
        <Input id="linkedinUrl" name="linkedinUrl" placeholder="https://www.linkedin.com/in/..." className="h-11" />
      </div>

      <div className="flex items-start gap-2 rounded-md border border-border bg-muted p-3">
        <input id="consent" name="consent" type="checkbox" required className="mt-1 h-4 w-4" />
        <Label htmlFor="consent" className="text-sm font-normal leading-snug">
          {ALUMNI_CONSENT_V1} Read the full{" "}
          <Link href="/privacy" className="underline">
            privacy notice
          </Link>
          .
        </Label>
      </div>

      {state?.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending || photoUploading} className="h-11 w-full">
        {pending ? "Submitting..." : "Submit"}
      </Button>
    </form>
  );
}
