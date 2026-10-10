"use client";

import { useState } from "react";
import type { MediaAsset } from "@prisma/client";
import type { SettingValue } from "@/server/services/site-settings";
import { saveHodAction } from "@/server/actions/site-settings";
import { useSectionSave } from "../use-section-save";
import { VersionHistoryDialog } from "../version-history-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MediaPicker } from "@/components/admin/media-picker";
import { RichTextEditor } from "@/components/admin/rich-text-editor";

export function HodSection({
  value,
  existingMedia,
}: {
  value: SettingValue<"hod.welcomeAddress">;
  existingMedia: MediaAsset[];
}) {
  const [name, setName] = useState(value.name);
  const [title, setTitle] = useState(value.title);
  const [message, setMessage] = useState(value.message);
  const [photo, setPhoto] = useState(
    value.photoId ? { id: value.photoId, url: "", alt: "" } : null,
  );
  const { result, pending, save, setDirty } = useSectionSave(saveHodAction);

  return (
    <section className="space-y-3 border-b border-border pb-8">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl font-semibold">HOD welcome address</h2>
        <VersionHistoryDialog settingsKey="hod.welcomeAddress" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="hod-name">Name</Label>
        <Input id="hod-name" value={name} onChange={(e) => { setName(e.target.value); setDirty(true); }} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="hod-title">Title</Label>
        <Input id="hod-title" value={title} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} />
      </div>
      <MediaPicker
        folder="site"
        existing={existingMedia}
        value={photo}
        onChange={(m) => { setPhoto(m); setDirty(true); }}
        label="Photo"
      />
      <div className="space-y-1.5">
        <Label>Welcome message</Label>
        <RichTextEditor
          initialHtml={message}
          onChange={(html) => { setMessage(html); setDirty(true); }}
          existingMedia={existingMedia}
        />
      </div>
      {result?.error ? <Alert variant="destructive"><AlertDescription>{result.error}</AlertDescription></Alert> : null}
      {result?.success ? <Alert><AlertDescription>Saved.</AlertDescription></Alert> : null}
      <Button
        onClick={() => {
          const fd = new FormData();
          fd.set("name", name);
          fd.set("title", title);
          fd.set("photoId", photo?.id ?? "");
          fd.set("message", message);
          save(fd);
        }}
        disabled={pending}
      >
        {pending ? "Saving..." : "Save"}
      </Button>
    </section>
  );
}
