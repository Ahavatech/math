"use client";

import { useEffect, useState, useTransition } from "react";
import type { MediaAsset, ResearchArea } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MediaPicker, type SelectedMedia } from "@/components/admin/media-picker";
import { RichTextEditor } from "@/components/admin/rich-text-editor";

export type LecturerSelfFieldsValue = {
  photoId: string | null;
  honorific: string;
  bio: string;
  researchAreaIds: string[];
  officeLocation: string;
  officeHours: string;
  publicEmail: string;
  phone: string;
  scholarUrl: string;
  orcid: string;
  researchGateUrl: string;
  linkedinUrl: string;
  supervisionText: string;
};

export function LecturerSelfFieldsForm({
  value,
  existingMedia,
  allResearchAreas,
  photoAsset,
  saveAction,
  hiddenFields,
}: {
  value: LecturerSelfFieldsValue;
  existingMedia: MediaAsset[];
  allResearchAreas: ResearchArea[];
  photoAsset: MediaAsset | null;
  saveAction: (prevState: { error?: string; success?: boolean } | undefined, formData: FormData) => Promise<{ error?: string; success?: boolean }>;
  hiddenFields?: Record<string, string>;
}) {
  const [photo, setPhoto] = useState<SelectedMedia | null>(
    photoAsset ? { id: photoAsset.id, url: photoAsset.url, alt: photoAsset.alt ?? "" } : null,
  );
  const [honorific, setHonorific] = useState(value.honorific);
  const [bio, setBio] = useState(value.bio);
  const [researchAreaIds, setResearchAreaIds] = useState<string[]>(value.researchAreaIds);
  const [officeLocation, setOfficeLocation] = useState(value.officeLocation);
  const [officeHours, setOfficeHours] = useState(value.officeHours);
  const [publicEmail, setPublicEmail] = useState(value.publicEmail);
  const [phone, setPhone] = useState(value.phone);
  const [scholarUrl, setScholarUrl] = useState(value.scholarUrl);
  const [orcid, setOrcid] = useState(value.orcid);
  const [researchGateUrl, setResearchGateUrl] = useState(value.researchGateUrl);
  const [linkedinUrl, setLinkedinUrl] = useState(value.linkedinUrl);
  const [supervisionText, setSupervisionText] = useState(value.supervisionText);
  const [dirty, setDirty] = useState(false);
  const [result, setResult] = useState<{ error?: string; success?: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (dirty) e.preventDefault();
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function toggleArea(id: string) {
    setResearchAreaIds((prev) => (prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]));
    setDirty(true);
  }

  function save() {
    setResult(null);
    startTransition(async () => {
      const fd = new FormData();
      if (hiddenFields) {
        for (const [key, val] of Object.entries(hiddenFields)) fd.set(key, val);
      }
      fd.set("photoId", photo?.id ?? "");
      fd.set("honorific", honorific);
      fd.set("bio", bio);
      researchAreaIds.forEach((id) => fd.append("researchAreaIds", id));
      fd.set("officeLocation", officeLocation);
      fd.set("officeHours", officeHours);
      fd.set("publicEmail", publicEmail);
      fd.set("phone", phone);
      fd.set("scholarUrl", scholarUrl);
      fd.set("orcid", orcid);
      fd.set("researchGateUrl", researchGateUrl);
      fd.set("linkedinUrl", linkedinUrl);
      fd.set("supervisionText", supervisionText);
      const res = await saveAction(undefined, fd);
      setResult(res);
      if (!res.error) setDirty(false);
    });
  }

  return (
    <div className="space-y-4">
      <MediaPicker
        folder="lecturers"
        existing={existingMedia}
        value={photo}
        onChange={(m) => {
          setPhoto(m);
          setDirty(true);
        }}
        label="Photo"
      />

      <div className="space-y-1.5">
        <Label htmlFor="lecturer-honorific">Honorific</Label>
        <Input id="lecturer-honorific" value={honorific} onChange={(e) => { setHonorific(e.target.value); setDirty(true); }} placeholder="Dr., Prof." />
      </div>

      <div className="space-y-1.5">
        <Label>Bio</Label>
        <RichTextEditor initialHtml={bio} existingMedia={existingMedia} onChange={(html) => { setBio(html); setDirty(true); }} />
      </div>

      <div className="space-y-1.5">
        <Label>Research areas</Label>
        <div className="grid grid-cols-2 gap-2">
          {allResearchAreas.map((area) => (
            <label key={area.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={researchAreaIds.includes(area.id)} onChange={() => toggleArea(area.id)} />
              {area.title}
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="lecturer-office">Office location</Label>
          <Input id="lecturer-office" value={officeLocation} onChange={(e) => { setOfficeLocation(e.target.value); setDirty(true); }} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lecturer-hours">Office hours</Label>
          <Input id="lecturer-hours" value={officeHours} onChange={(e) => { setOfficeHours(e.target.value); setDirty(true); }} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lecturer-public-email">Public email (shown on your page; your login email never is)</Label>
          <Input id="lecturer-public-email" type="email" value={publicEmail} onChange={(e) => { setPublicEmail(e.target.value); setDirty(true); }} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lecturer-phone">Phone</Label>
          <Input id="lecturer-phone" value={phone} onChange={(e) => { setPhone(e.target.value); setDirty(true); }} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lecturer-scholar">Google Scholar URL</Label>
          <Input id="lecturer-scholar" value={scholarUrl} onChange={(e) => { setScholarUrl(e.target.value); setDirty(true); }} placeholder="https://scholar.google.com/..." />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lecturer-orcid">ORCID iD</Label>
          <Input id="lecturer-orcid" value={orcid} onChange={(e) => { setOrcid(e.target.value); setDirty(true); }} placeholder="0000-0000-0000-0000" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lecturer-researchgate">ResearchGate URL</Label>
          <Input id="lecturer-researchgate" value={researchGateUrl} onChange={(e) => { setResearchGateUrl(e.target.value); setDirty(true); }} placeholder="https://www.researchgate.net/..." />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lecturer-linkedin">LinkedIn URL</Label>
          <Input id="lecturer-linkedin" value={linkedinUrl} onChange={(e) => { setLinkedinUrl(e.target.value); setDirty(true); }} placeholder="https://www.linkedin.com/in/..." />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Students and supervision</Label>
        <RichTextEditor initialHtml={supervisionText} existingMedia={existingMedia} onChange={(html) => { setSupervisionText(html); setDirty(true); }} />
      </div>

      {result?.error ? <Alert variant="destructive"><AlertDescription>{result.error}</AlertDescription></Alert> : null}
      {result?.success ? <Alert><AlertDescription>Saved.</AlertDescription></Alert> : null}
      {dirty && !result?.success ? <p className="text-xs text-muted-foreground">You have unsaved changes.</p> : null}

      <Button onClick={save} disabled={pending}>
        {pending ? "Saving..." : "Save"}
      </Button>
    </div>
  );
}
