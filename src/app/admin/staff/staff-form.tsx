"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MediaAsset, NonTeachingStaff } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MediaPicker, type SelectedMedia } from "@/components/admin/media-picker";
import { VersionHistoryDialog } from "@/components/admin/version-history-dialog";
import {
  createNonTeachingStaffAction,
  updateNonTeachingStaffAction,
  listNonTeachingStaffRevisionsAction,
  restoreNonTeachingStaffAction,
} from "@/server/actions/non-teaching-staff";

type ExistingStaff = NonTeachingStaff & { photo: MediaAsset | null };

export function StaffForm({
  staff,
  existingMedia,
}: {
  staff: ExistingStaff | null;
  existingMedia: MediaAsset[];
}) {
  const router = useRouter();
  const [name, setName] = useState(staff?.name ?? "");
  const [position, setPosition] = useState(staff?.position ?? "");
  const [email, setEmail] = useState(staff?.email ?? "");
  const [phone, setPhone] = useState(staff?.phone ?? "");
  const [showContact, setShowContact] = useState(staff?.showContact ?? false);
  const [photo, setPhoto] = useState<SelectedMedia | null>(
    staff?.photo ? { id: staff.photo.id, url: staff.photo.url, alt: staff.photo.alt ?? "" } : null,
  );
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

  function save() {
    setResult(null);
    startTransition(async () => {
      const fd = new FormData();
      if (staff) fd.set("id", staff.id);
      fd.set("name", name);
      fd.set("position", position);
      fd.set("photoId", photo?.id ?? "");
      fd.set("email", email);
      fd.set("phone", phone);
      fd.set("showContact", String(showContact));
      const action = staff ? updateNonTeachingStaffAction : createNonTeachingStaffAction;
      const res = await action(undefined, fd);
      setResult(res);
      if (!res.error) {
        setDirty(false);
        if (!staff && res.id) router.push(`/admin/staff/${res.id}`);
      }
    });
  }

  return (
    <div className="max-w-xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-lg font-semibold">{staff ? staff.name : "New staff member"}</h1>
        {staff ? (
          <VersionHistoryDialog
            listRevisions={() => listNonTeachingStaffRevisionsAction(staff.id)}
            onRestore={async (revisionId) => {
              const fd = new FormData();
              fd.set("id", staff.id);
              fd.set("revisionId", revisionId);
              await restoreNonTeachingStaffAction(fd);
            }}
          />
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="staff-name">Name</Label>
        <Input id="staff-name" value={name} onChange={(e) => { setName(e.target.value); setDirty(true); }} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="staff-position">Position</Label>
        <Input id="staff-position" value={position} onChange={(e) => { setPosition(e.target.value); setDirty(true); }} />
      </div>

      <MediaPicker
        folder="staff"
        existing={existingMedia}
        value={photo}
        onChange={(m) => { setPhoto(m); setDirty(true); }}
        label="Photo (optional)"
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="staff-email">Email</Label>
          <Input id="staff-email" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setDirty(true); }} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="staff-phone">Phone</Label>
          <Input id="staff-phone" value={phone} onChange={(e) => { setPhone(e.target.value); setDirty(true); }} />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={showContact}
          onChange={(e) => { setShowContact(e.target.checked); setDirty(true); }}
        />
        Show email and phone on the public staff page
      </label>

      {result?.error ? (
        <Alert variant="destructive">
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      ) : null}
      {result?.success ? (
        <Alert>
          <AlertDescription>Saved.</AlertDescription>
        </Alert>
      ) : null}
      {dirty && !result?.success ? (
        <p className="text-xs text-muted-foreground">You have unsaved changes.</p>
      ) : null}

      <Button onClick={save} disabled={pending || !name.trim() || !position.trim()}>
        {pending ? "Saving..." : "Save"}
      </Button>
    </div>
  );
}
