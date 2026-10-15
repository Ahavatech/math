"use client";

import { useState } from "react";
import type { SettingValue } from "@/server/services/site-settings";
import { saveSocialLinksAction } from "@/server/actions/site-settings";
import { useSectionSave } from "../use-section-save";
import { VersionHistoryDialog } from "../version-history-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Trash2 } from "lucide-react";

type LinkRow = { label: string; url: string };

export function SocialLinksSection({ value }: { value: SettingValue<"social.links"> }) {
  const initial = Object.entries(value).map(([label, url]) => ({ label, url }));
  const [links, setLinks] = useState<LinkRow[]>(initial.length ? initial : [{ label: "", url: "" }]);
  const { result, pending, save, setDirty } = useSectionSave(saveSocialLinksAction);

  return (
    <section className="space-y-3 border-b border-border pb-8">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl font-semibold">Social links</h2>
        <VersionHistoryDialog settingsKey="social.links" />
      </div>
      {links.map((link, i) => (
        <div key={i} className="flex gap-2">
          <div className="flex-1 space-y-1.5">
            <Label>Label</Label>
            <Input
              value={link.label}
              onChange={(e) => {
                setLinks((prev) => prev.map((l, idx) => (idx === i ? { ...l, label: e.target.value } : l)));
                setDirty(true);
              }}
            />
          </div>
          <div className="flex-1 space-y-1.5">
            <Label>URL</Label>
            <Input
              value={link.url}
              onChange={(e) => {
                setLinks((prev) => prev.map((l, idx) => (idx === i ? { ...l, url: e.target.value } : l)));
                setDirty(true);
              }}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="self-end"
            onClick={() => {
              setLinks((prev) => prev.filter((_, idx) => idx !== i));
              setDirty(true);
            }}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => setLinks((prev) => [...prev, { label: "", url: "" }])}>
        <Plus className="size-4" /> Add link
      </Button>
      {result?.error ? <Alert variant="destructive"><AlertDescription>{result.error}</AlertDescription></Alert> : null}
      {result?.success ? <Alert><AlertDescription>Saved.</AlertDescription></Alert> : null}
      <Button
        onClick={() => {
          const fd = new FormData();
          links.forEach(({ label, url }) => {
            if (label && url) {
              fd.append("label", label);
              fd.append("url", url);
            }
          });
          save(fd);
        }}
        disabled={pending}
      >
        {pending ? "Saving..." : "Save"}
      </Button>
    </section>
  );
}
