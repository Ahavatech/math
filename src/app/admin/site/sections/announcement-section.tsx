"use client";

import { useState } from "react";
import type { SettingValue } from "@/server/services/site-settings";
import { saveAnnouncementAction } from "@/server/actions/site-settings";
import { useSectionSave } from "../use-section-save";
import { VersionHistoryDialog } from "../version-history-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function AnnouncementSection({ value }: { value: SettingValue<"site.announcement"> }) {
  const [enabled, setEnabled] = useState(value.enabled);
  const [message, setMessage] = useState(value.message);
  const [href, setHref] = useState(value.href ?? "");
  const { result, pending, save, setDirty } = useSectionSave(saveAnnouncementAction);

  return (
    <section className="space-y-3 border-b border-border pb-8">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl font-semibold">Announcement bar</h2>
        <VersionHistoryDialog settingsKey="site.announcement" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => { setEnabled(e.target.checked); setDirty(true); }}
        />
        Enabled
      </label>
      <div className="space-y-1.5">
        <Label htmlFor="announcement-message">Message</Label>
        <Input id="announcement-message" value={message} onChange={(e) => { setMessage(e.target.value); setDirty(true); }} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="announcement-href">Link (optional)</Label>
        <Input id="announcement-href" value={href} onChange={(e) => { setHref(e.target.value); setDirty(true); }} />
      </div>
      {result?.error ? <Alert variant="destructive"><AlertDescription>{result.error}</AlertDescription></Alert> : null}
      {result?.success ? <Alert><AlertDescription>Saved.</AlertDescription></Alert> : null}
      <Button
        onClick={() => {
          const fd = new FormData();
          fd.set("enabled", enabled ? "true" : "false");
          fd.set("message", message);
          fd.set("href", href);
          save(fd);
        }}
        disabled={pending}
      >
        {pending ? "Saving..." : "Save"}
      </Button>
    </section>
  );
}
