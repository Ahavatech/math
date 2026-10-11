"use client";

import { useState, useTransition } from "react";
import { LecturerRank } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { rankLabel } from "@/lib/lecturer-rank";
import { createLecturerAction } from "@/server/actions/lecturers";

export function CreateLecturerForm() {
  const [fullName, setFullName] = useState("");
  const [honorific, setHonorific] = useState("");
  const [rank, setRank] = useState<LecturerRank>("LECTURER_I");
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<{ error?: string; success?: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  function create() {
    setResult(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("fullName", fullName);
      fd.set("honorific", honorific);
      fd.set("rank", rank);
      fd.set("email", email);
      const res = await createLecturerAction(undefined, fd);
      setResult(res);
      if (!res.error) {
        setFullName("");
        setHonorific("");
        setEmail("");
      }
    });
  }

  return (
    <section className="space-y-3 rounded-md border border-dashed border-border p-4">
      <h2 className="font-heading text-base font-semibold">Create a lecturer</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="new-lecturer-name">Full name</Label>
          <Input id="new-lecturer-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-lecturer-honorific">Honorific</Label>
          <Input id="new-lecturer-honorific" value={honorific} onChange={(e) => setHonorific(e.target.value)} placeholder="Dr., Prof." />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-lecturer-rank">Rank</Label>
          <select
            id="new-lecturer-rank"
            className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={rank}
            onChange={(e) => setRank(e.target.value as LecturerRank)}
          >
            {Object.values(LecturerRank).map((r) => (
              <option key={r} value={r}>
                {rankLabel(r)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-lecturer-email">Official email</Label>
          <Input id="new-lecturer-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
      </div>
      {result?.error ? <Alert variant="destructive"><AlertDescription>{result.error}</AlertDescription></Alert> : null}
      {result?.success ? <Alert><AlertDescription>Created. Send an invite from the row below when ready.</AlertDescription></Alert> : null}
      <Button onClick={create} disabled={pending || !fullName.trim() || !email.trim()}>
        {pending ? "Creating..." : "Create"}
      </Button>
    </section>
  );
}
