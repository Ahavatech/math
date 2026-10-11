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
        <Select
          value={lecturerProfileId}
          onValueChange={(next) => {
            setLecturerProfileId(next ?? "");
            setDirty(true);
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Choose a published lecturer" />
          </SelectTrigger>
          <SelectContent>
            {publishedLecturers.map((lecturer) => (
              <SelectItem key={lecturer.id} value={lecturer.id}>
                {lecturer.fullName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
