"use client";

import { useState, useTransition } from "react";
import { createBoardMemberAction } from "@/server/actions/journal-board";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

const ROLE_TITLES = ["Editor-in-Chief", "Associate Editor", "Editorial Board Member", "Advisory Board Member"];

export function BoardMemberForm({ lecturers }: { lecturers: { id: string; fullName: string }[] }) {
  const [mode, setMode] = useState<"lecturer" | "external">("lecturer");
  const [result, setResult] = useState<{ error?: string; success?: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  function save(formData: FormData) {
    if (mode === "lecturer") {
      const lecturerId = String(formData.get("lecturerProfileId") ?? "");
      const lecturer = lecturers.find((l) => l.id === lecturerId);
      // The row's own `name` is still required by the schema even for a
      // linked lecturer (the public query only prefers the live profile
      // name over it, it never relies on `name` being empty).
      formData.set("name", lecturer?.fullName ?? "");
      formData.delete("affiliation");
      formData.delete("affiliationCountry");
      formData.delete("orcid");
      formData.delete("externalUrl");
    } else {
      formData.delete("lecturerProfileId");
    }
    startTransition(async () => {
      const res = await createBoardMemberAction(undefined, formData);
      setResult(res);
    });
  }

  return (
    <form action={save} className="space-y-3 rounded-md border border-border p-4">
      <h2 className="font-heading text-sm font-semibold">Add a board member</h2>
      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-1.5">
          <input type="radio" checked={mode === "lecturer"} onChange={() => setMode("lecturer")} /> Published lecturer
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" checked={mode === "external"} onChange={() => setMode("external")} /> External member
        </label>
      </div>

      {mode === "lecturer" ? (
        <select name="lecturerProfileId" className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
          <option value="">Choose a lecturer...</option>
          {lecturers.map((l) => (
            <option key={l.id} value={l.id}>{l.fullName}</option>
          ))}
        </select>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Input name="name" placeholder="Name" />
          <Input name="affiliation" placeholder="Affiliation" />
          <Input name="affiliationCountry" placeholder="Country" />
          <Input name="orcid" placeholder="ORCID (optional)" />
          <Input name="externalUrl" placeholder="https://... (optional)" />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="roleTitle">Role title</Label>
          <Input id="roleTitle" name="roleTitle" list="role-titles" placeholder="Editor-in-Chief" />
          <datalist id="role-titles">
            {ROLE_TITLES.map((r) => <option key={r} value={r} />)}
          </datalist>
        </div>
        <div className="flex items-end gap-2">
          <input type="checkbox" name="isActive" id="isActive" defaultChecked className="size-4" />
          <Label htmlFor="isActive">Active (visible publicly)</Label>
        </div>
      </div>

      {result?.error ? <Alert variant="destructive"><AlertDescription>{result.error}</AlertDescription></Alert> : null}
      <Button type="submit" disabled={pending}>{pending ? "Adding..." : "Add member"}</Button>
    </form>
  );
}
