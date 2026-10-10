"use client";

import { useState } from "react";
import type { SettingValue } from "@/server/services/site-settings";
import { saveStatsAction } from "@/server/actions/site-settings";
import { useSectionSave } from "../use-section-save";
import { VersionHistoryDialog } from "../version-history-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type StatMode = { mode: "auto" | "manual"; manualValue: number | null };

const STAT_NAMES = [
  { key: "staff", label: "Staff" },
  { key: "alumni", label: "Alumni" },
  { key: "programmes", label: "Programmes" },
  { key: "researchAreas", label: "Research areas" },
] as const;

export function StatsSection({ value }: { value: SettingValue<"homepage.stats"> }) {
  const [stats, setStats] = useState<Record<string, StatMode>>(value);
  const { result, pending, save, setDirty } = useSectionSave(saveStatsAction);

  function update(key: string, patch: Partial<StatMode>) {
    setStats((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
    setDirty(true);
  }

  return (
    <section className="space-y-3 border-b border-border pb-8">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl font-semibold">Stats</h2>
        <VersionHistoryDialog settingsKey="homepage.stats" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {STAT_NAMES.map(({ key, label }) => {
          const stat = stats[key];
          return (
            <div key={key} className="space-y-1.5 rounded-md border border-border p-3">
              <Label>{label}</Label>
              <Select
                value={stat.mode}
                onValueChange={(mode) => update(key, { mode: mode as "auto" | "manual" })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Automatic (computed)</SelectItem>
                  <SelectItem value="manual">Manual override</SelectItem>
                </SelectContent>
              </Select>
              {stat.mode === "manual" ? (
                <Input
                  type="number"
                  value={stat.manualValue ?? ""}
                  onChange={(e) =>
                    update(key, { manualValue: e.target.value === "" ? null : Number(e.target.value) })
                  }
                  placeholder="Manual value"
                />
              ) : (
                <p className="text-xs text-muted-foreground">Computed automatically from the database.</p>
              )}
            </div>
          );
        })}
      </div>
      {result?.error ? <Alert variant="destructive"><AlertDescription>{result.error}</AlertDescription></Alert> : null}
      {result?.success ? <Alert><AlertDescription>Saved.</AlertDescription></Alert> : null}
      <Button
        onClick={() => {
          const fd = new FormData();
          for (const { key } of STAT_NAMES) {
            fd.set(`${key}Mode`, stats[key].mode);
            fd.set(`${key}Value`, stats[key].manualValue === null ? "" : String(stats[key].manualValue));
          }
          save(fd);
        }}
        disabled={pending}
      >
        {pending ? "Saving..." : "Save"}
      </Button>
    </section>
  );
}
