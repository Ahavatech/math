"use client";

import { useState } from "react";
import type { MediaAsset } from "@prisma/client";
import type { SettingValue } from "@/server/services/site-settings";
import { saveAboutImageAction } from "@/server/actions/site-settings";
import { useSectionSave } from "../use-section-save";
import { VersionHistoryDialog } from "../version-history-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SavedMark } from "@/components/ui/saved-mark";
import { MediaPicker } from "@/components/admin/media-picker";

export function AboutImageSection({
  value,
  existingMedia,
}: {
  value: SettingValue<"about.image">;
  existingMedia: MediaAsset[];
}) {
  const [caption, setCaption] = useState(value.caption);
  const [image, setImage] = useState(value.imageId ? { id: value.imageId, url: "", alt: "" } : null);
  const { result, pending, save, setDirty } = useSectionSave(saveAboutImageAction);

  return (
    <section className="space-y-3 border-b border-border pb-8">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl font-semibold">About page image</h2>
        <VersionHistoryDialog settingsKey="about.image" />
      </div>
      <p className="text-muted-foreground">
        A photograph shown near the top of the About page, such as the department building. Add a short description in the
        image&apos;s alt text for people who cannot see it, and an optional caption that appears beneath it.
      </p>
      <MediaPicker
        folder="site"
        existing={existingMedia}
        value={image}
        onChange={(m) => {
          setImage(m);
          setDirty(true);
        }}
        label="Photograph"
      />
      <div className="space-y-1.5">
        <Label htmlFor="about-caption">Caption (optional)</Label>
        <Input
          id="about-caption"
          value={caption}
          maxLength={200}
          onChange={(e) => {
            setCaption(e.target.value);
            setDirty(true);
          }}
        />
      </div>
      {result?.error ? (
        <Alert variant="destructive">
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      ) : null}
      {result?.success ? <SavedMark /> : null}
      <Button
        onClick={() => {
          const fd = new FormData();
          fd.set("imageId", image?.id ?? "");
          fd.set("caption", caption);
          save(fd);
        }}
        disabled={pending}
      >
        {pending ? "Saving..." : "Save"}
      </Button>
    </section>
  );
}
