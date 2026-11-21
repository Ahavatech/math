"use client";

import { useState } from "react";
import type { SettingValue } from "@/server/services/site-settings";
import { saveStudentAssociationAction } from "@/server/actions/site-settings";
import { useSectionSave } from "../use-section-save";
import { VersionHistoryDialog } from "../version-history-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SavedMark } from "@/components/ui/saved-mark";

export function StudentAssociationSection({ value }: { value: SettingValue<"students.association"> }) {
  const [label, setLabel] = useState(value.label);
  const [url, setUrl] = useState(value.url);
  const [description, setDescription] = useState(value.description);
  const { result, pending, save, setDirty } = useSectionSave(saveStudentAssociationAction);

  return (
    <section className="space-y-3 border-b border-border pb-8">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl font-semibold">Student association link</h2>
        <VersionHistoryDialog settingsKey="students.association" />
      </div>
      <p className="text-muted-foreground">
        A link to the student association&apos;s own website, shown on the Students page. Leave the address empty to hide it.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="assoc-label">Name shown on the page</Label>
        <Input id="assoc-label" value={label} maxLength={80} onChange={(e) => { setLabel(e.target.value); setDirty(true); }} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="assoc-url">Website address (starts with https://)</Label>
        <Input id="assoc-url" type="url" value={url} placeholder="https://" onChange={(e) => { setUrl(e.target.value); setDirty(true); }} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="assoc-description">One line about it (optional)</Label>
        <Input id="assoc-description" value={description} maxLength={200} onChange={(e) => { setDescription(e.target.value); setDirty(true); }} />
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
          fd.set("label", label);
          fd.set("url", url);
          fd.set("description", description);
          save(fd);
        }}
        disabled={pending}
      >
        {pending ? "Saving..." : "Save"}
      </Button>
    </section>
  );
}
