"use client";

import { useActionState, useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { COUNTRIES } from "@/lib/countries";
import { INDUSTRIES } from "@/lib/industries";
import { ALUMNI_CONSENT_V1 } from "@/lib/alumni-consent";

type ActionResult = { error?: string; success?: boolean; confirmToken?: string };
type BoundAction = (prevState: ActionResult | undefined, formData: FormData) => Promise<ActionResult>;

const currentYear = new Date().getFullYear();

const LEVELS = [
  { value: "BSC", label: "B.Sc." },
  { value: "MSC", label: "M.Sc." },
  { value: "PHD", label: "Ph.D." },
] as const;

type LevelValue = (typeof LEVELS)[number]["value"];

interface ProgrammeRow {
  level: LevelValue;
  entryYear: string;
  graduationYear: string;
}

async function uploadAlumniPhoto(file: File, token: string): Promise<string> {
  const { compressImage } = await import("@/components/admin/image-compress");
  const { file: compressed } = await compressImage(file, { maxWidthOrHeight: 1200, maxSizeMB: 0.3 });

  const signRes = await fetch("/api/alumni-upload-signing", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  if (!signRes.ok) throw new Error("Could not get upload permission");
  const sign = await signRes.json();

  const body = new FormData();
  body.set("file", compressed);
  body.set("api_key", sign.apiKey);
  body.set("timestamp", String(sign.timestamp));
  body.set("signature", sign.signature);
  body.set("folder", sign.folder);
  body.set("type", sign.type);
  body.set("allowed_formats", sign.allowedFormats.join(","));

  const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${sign.cloudName}/image/upload`, { method: "POST", body });
  if (!uploadRes.ok) {
    const detail = await uploadRes.json().catch(() => null);
    throw new Error(detail?.error?.message ?? "Photo upload failed");
  }
  const result = await uploadRes.json();
  return result.public_id as string;
}

function emptyProgramme(defaultYear?: number): ProgrammeRow {
  return { level: "BSC", entryYear: "", graduationYear: defaultYear ? String(defaultYear) : "" };
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
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, undefined);
  const [photoPublicId, setPhotoPublicId] = useState("");
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [programmes, setProgrammes] = useState<ProgrammeRow[]>([emptyProgramme(cohortYear ?? undefined)]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state?.success && state.confirmToken) {
      router.push(`/alumni/confirm/${encodeURIComponent(state.confirmToken)}`);
    }
  }, [state, router]);

  if (state?.success) {
    return (
      <p className="mt-6 text-sm">
        Thank you. Your details were received and will appear after the department has reviewed them.
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

  function updateProgramme(i: number, key: keyof ProgrammeRow, value: string) {
    setProgrammes((prev) => prev.map((p, idx) => (idx === i ? { ...p, [key]: value } : p)));
  }

  function addProgramme() {
    if (programmes.length >= 3) return;
    const usedLevels = new Set(programmes.map((p) => p.level));
    const next = (LEVELS.find((l) => !usedLevels.has(l.value))?.value ?? "MSC") as LevelValue;
    setProgrammes((prev) => [...prev, { level: next, entryYear: "", graduationYear: "" }]);
  }

  function removeProgramme(i: number) {
    setProgrammes((prev) => prev.filter((_, idx) => idx !== i));
  }

  return (
    <form action={formAction} className="mt-6 space-y-5">
      <input type="hidden" name="formToken" value={formToken} />
      <input type="hidden" name="formRenderedAt" value={formRenderedAt} />
      <input type="hidden" name="photoPublicId" value={photoPublicId} />

      {/* Honeypot */}
      <div style={{ position: "absolute", left: "-9999px", top: "-9999px" }} aria-hidden="true">
        <label htmlFor="website">Leave this field empty</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="fullName">Full name</Label>
        <Input id="fullName" name="fullName" required maxLength={120} className="h-11" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">Email address (never shown publicly)</Label>
        <Input id="email" name="email" type="email" required maxLength={254} className="h-11" />
      </div>

      {/* Programmes */}
      <fieldset className="space-y-3 rounded-md border border-border p-4">
        <legend className="px-1 text-sm font-medium">Programme(s) studied at OAU</legend>
        {programmes.map((prog, i) => (
          <div key={i} className="space-y-3 rounded-md bg-muted/40 p-3">
            <input type="hidden" name={`programmes[${i}][level]`} value={prog.level} />
            <input type="hidden" name={`programmes[${i}][entryYear]`} value={prog.entryYear} />
            <input type="hidden" name={`programmes[${i}][graduationYear]`} value={prog.graduationYear} />
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">Programme {i + 1}</span>
              {i > 0 ? (
                <button
                  type="button"
                  onClick={() => removeProgramme(i)}
                  className="text-xs text-destructive hover:underline"
                >
                  Remove
                </button>
              ) : null}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor={`level-${i}`} className="text-xs">Degree</Label>
                <select
                  id={`level-${i}`}
                  value={prog.level}
                  onChange={(e) => updateProgramme(i, "level", e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                >
                  {LEVELS.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor={`entryYear-${i}`} className="text-xs">Year started (optional)</Label>
                <Input
                  id={`entryYear-${i}`}
                  type="number"
                  min={1965}
                  max={currentYear}
                  value={prog.entryYear}
                  onChange={(e) => updateProgramme(i, "entryYear", e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`gradYear-${i}`} className="text-xs">Graduation year</Label>
                <Input
                  id={`gradYear-${i}`}
                  type="number"
                  min={1965}
                  max={currentYear + 1}
                  value={prog.graduationYear}
                  onChange={(e) => updateProgramme(i, "graduationYear", e.target.value)}
                  required
                  className="h-9"
                />
              </div>
            </div>
          </div>
        ))}
        {programmes.length < 3 ? (
          <button
            type="button"
            onClick={addProgramme}
            className="text-xs text-primary hover:underline"
          >
            + Add another degree
          </button>
        ) : null}
      </fieldset>

      <div className="space-y-1.5">
        <Label htmlFor="organisation">Current organisation</Label>
        <Input id="organisation" name="organisation" maxLength={120} className="h-11" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="roleOrField">Role or field of work</Label>
        <Input id="roleOrField" name="roleOrField" maxLength={120} className="h-11" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="note">One-line note (optional, shown publicly)</Label>
        <Input id="note" name="note" maxLength={200} className="h-11" placeholder="e.g. Founder of Acme Ltd, working on applied maths" />
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
            {INDUSTRIES.map((ind) => (
              <option key={ind} value={ind}>{ind}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="linkedinUrl">LinkedIn URL (optional)</Label>
        <Input id="linkedinUrl" name="linkedinUrl" placeholder="https://www.linkedin.com/in/..." className="h-11" />
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

      <div className="flex items-start gap-2 rounded-md border border-border bg-muted p-3">
        <input id="consentPublicDisplay" name="consentPublicDisplay" type="checkbox" required className="mt-1 h-4 w-4" />
        <Label htmlFor="consentPublicDisplay" className="text-sm font-normal leading-snug">
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
