"use client";

import { useState } from "react";
import type { MediaAsset } from "@prisma/client";
import type { SettingValue } from "@/server/services/site-settings";
import { saveIdentityAction } from "@/server/actions/site-settings";
import { useSectionSave } from "../use-section-save";
import { VersionHistoryDialog } from "../version-history-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MediaPicker } from "@/components/admin/media-picker";

export function IdentitySection({
  value,
  existingMedia,
}: {
  value: SettingValue<"identity">;
  existingMedia: MediaAsset[];
}) {
  const [name, setName] = useState(value.name);
  const [tagline, setTagline] = useState(value.tagline);
  const [logo, setLogo] = useState(
    value.logoId ? { id: value.logoId, url: "", alt: "" } : null,
  );
  const { result, pending, save, setDirty } = useSectionSave(saveIdentityAction);

  return (
    <section className="space-y-3 border-b border-border pb-8">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl font-semibold">Identity</h2>
        <VersionHistoryDialog settingsKey="identity" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="identity-name">Department name</Label>
        <Input id="identity-name" value={name} onChange={(e) => { setName(e.target.value); setDirty(true); }} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="identity-tagline">Tagline</Label>
        <Input id="identity-tagline" value={tagline} onChange={(e) => { setTagline(e.target.value); setDirty(true); }} />
      </div>
      <MediaPicker
        folder="site"
        existing={existingMedia}
        value={logo}
        onChange={(m) => { setLogo(m); setDirty(true); }}
        label="Logo"
      />
      {result?.error ? <Alert variant="destructive"><AlertDescription>{result.error}</AlertDescription></Alert> : null}
      {result?.success ? <Alert><AlertDescription>Saved.</AlertDescription></Alert> : null}
      <Button
        onClick={() => {
          const fd = new FormData();
          fd.set("name", name);
          fd.set("tagline", tagline);
          fd.set("logoId", logo?.id ?? "");
          save(fd);
        }}
        disabled={pending}
      >
        {pending ? "Saving..." : "Save"}
      </Button>
    </section>
  );
}
