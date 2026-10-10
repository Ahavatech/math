"use client";

import { useState } from "react";
import type { MediaAsset } from "@prisma/client";
import type { SettingValue } from "@/server/services/site-settings";
import { saveHeroAction } from "@/server/actions/site-settings";
import { useSectionSave } from "../use-section-save";
import { VersionHistoryDialog } from "../version-history-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MediaPicker } from "@/components/admin/media-picker";

export function HeroSection({
  value,
  existingMedia,
}: {
  value: SettingValue<"homepage.hero">;
  existingMedia: MediaAsset[];
}) {
  const [heading, setHeading] = useState(value.heading);
  const [subheading, setSubheading] = useState(value.subheading);
  const [ctaLabel, setCtaLabel] = useState(value.ctaLabel);
  const [ctaHref, setCtaHref] = useState(value.ctaHref);
  const [image, setImage] = useState(
    value.imageId ? { id: value.imageId, url: "", alt: "" } : null,
  );
  const { result, pending, save, setDirty } = useSectionSave(saveHeroAction);

  return (
    <section className="space-y-3 border-b border-border pb-8">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl font-semibold">Homepage hero</h2>
        <VersionHistoryDialog settingsKey="homepage.hero" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="hero-heading">Heading</Label>
        <Input id="hero-heading" value={heading} onChange={(e) => { setHeading(e.target.value); setDirty(true); }} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="hero-subheading">Subheading</Label>
        <Input id="hero-subheading" value={subheading} onChange={(e) => { setSubheading(e.target.value); setDirty(true); }} />
      </div>
      <MediaPicker
        folder="site"
        existing={existingMedia}
        value={image}
        onChange={(m) => { setImage(m); setDirty(true); }}
        label="Hero image"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="hero-cta-label">CTA label</Label>
          <Input id="hero-cta-label" value={ctaLabel} onChange={(e) => { setCtaLabel(e.target.value); setDirty(true); }} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hero-cta-href">CTA link</Label>
          <Input id="hero-cta-href" value={ctaHref} onChange={(e) => { setCtaHref(e.target.value); setDirty(true); }} />
        </div>
      </div>
      {result?.error ? <Alert variant="destructive"><AlertDescription>{result.error}</AlertDescription></Alert> : null}
      {result?.success ? <Alert><AlertDescription>Saved.</AlertDescription></Alert> : null}
      <Button
        onClick={() => {
          const fd = new FormData();
          fd.set("heading", heading);
          fd.set("subheading", subheading);
          fd.set("imageId", image?.id ?? "");
          fd.set("ctaLabel", ctaLabel);
          fd.set("ctaHref", ctaHref);
          save(fd);
        }}
        disabled={pending}
      >
        {pending ? "Saving..." : "Save"}
      </Button>
    </section>
  );
}
