"use client";

import { useState } from "react";
import type { SettingValue } from "@/server/services/site-settings";
import { saveFeaturedLecturerAction } from "@/server/actions/site-settings";
import { useSectionSave } from "../use-section-save";
import { VersionHistoryDialog } from "../version-history-dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

type PublishedLecturerOption = { id: string; fullName: string };

export function FeaturedLecturerSection({
  value,
  publishedLecturers,
}: {
  value: SettingValue<"homepage.featuredLecturer">;
  publishedLecturers: PublishedLecturerOption[];
}) {
  const [mode, setMode] = useState(value.mode);
  const [lecturerProfileId, setLecturerProfileId] = useState(value.lecturerProfileId ?? "");
  const { result, pending, save, setDirty } = useSectionSave(saveFeaturedLecturerAction);

  return (
    <section className="space-y-3 border-b border-border pb-8">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl font-semibold">Featured lecturer</h2>
        <VersionHistoryDialog settingsKey="homepage.featuredLecturer" />
      </div>

      <Select
        value={mode}
        onValueChange={(next) => {
          setMode(next as "manual" | "automatic");
          setDirty(true);
        }}
      >
        <SelectTrigger className="w-full sm:w-64">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="automatic">Automatic (rotates daily)</SelectItem>
          <SelectItem value="manual">Manual (choose one)</SelectItem>
        </SelectContent>
      </Select>

      {mode === "manual" ? (
        <div className="space-y-1.5">
          <Label htmlFor="featured-lecturer-id" className="sr-only">
            Choose a published lecturer
          </Label>
          <select
            id="featured-lecturer-id"
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={lecturerProfileId}
            onChange={(e) => {
              setLecturerProfileId(e.target.value);
              setDirty(true);
            }}
          >
            <option value="">Choose a published lecturer</option>
            {publishedLecturers.map((lecturer) => (
              <option key={lecturer.id} value={lecturer.id}>
                {lecturer.fullName}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Rotates daily among published profiles that have both a photo and a bio. The homepage block
          hides itself if none are eligible.
        </p>
      )}

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

      <Button
        onClick={() => {
          const fd = new FormData();
          fd.set("mode", mode);
          fd.set("lecturerProfileId", lecturerProfileId);
          save(fd);
        }}
        disabled={pending || (mode === "manual" && !lecturerProfileId)}
      >
        {pending ? "Saving..." : "Save"}
      </Button>
    </section>
  );
}
