"use client";

import { useState, useTransition } from "react";
import { LecturerRank, type ContentStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { rankLabel } from "@/lib/lecturer-rank";
import { updateLecturerAdminFieldsAction } from "@/server/actions/lecturers";

export function AdminFieldsForm({
  id,
  slug: initialSlug,
  rank: initialRank,
  status: initialStatus,
  order: initialOrder,
  isEmeritus: initialIsEmeritus,
}: {
  id: string;
  slug: string;
  rank: LecturerRank;
  status: ContentStatus;
  order: number;
  isEmeritus: boolean;
}) {
  const [slug, setSlug] = useState(initialSlug);
  const [rank, setRank] = useState(initialRank);
  const [status, setStatus] = useState(initialStatus);
  const [order, setOrder] = useState(initialOrder);
  const [isEmeritus, setIsEmeritus] = useState(initialIsEmeritus);
  const [result, setResult] = useState<{ error?: string; success?: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setResult(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", id);
      fd.set("slug", slug);
      fd.set("rank", rank);
      fd.set("status", status);
      fd.set("order", String(order));
      fd.set("isEmeritus", String(isEmeritus));
      const res = await updateLecturerAdminFieldsAction(undefined, fd);
      setResult(res);
    });
  }

  return (
    <section className="space-y-3 rounded-md border border-border p-4">
      <h2 className="font-heading text-base font-semibold">Admin fields</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="admin-slug">Slug</Label>
          <Input id="admin-slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
          <p className="text-xs text-muted-foreground">Changing this redirects the old address automatically.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="admin-rank">Rank</Label>
          <select id="admin-rank" className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm" value={rank} onChange={(e) => setRank(e.target.value as LecturerRank)}>
            {Object.values(LecturerRank).map((r) => (
              <option key={r} value={r}>{rankLabel(r)}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="admin-status">Status</Label>
          <select id="admin-status" className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value as ContentStatus)}>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="admin-order">Order</Label>
          <Input id="admin-order" type="number" value={order} onChange={(e) => setOrder(Number(e.target.value))} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isEmeritus} onChange={(e) => setIsEmeritus(e.target.checked)} />
          Emeritus
        </label>
      </div>
      {result?.error ? <Alert variant="destructive"><AlertDescription>{result.error}</AlertDescription></Alert> : null}
      {result?.success ? <Alert><AlertDescription>Saved.</AlertDescription></Alert> : null}
      <Button onClick={save} disabled={pending}>{pending ? "Saving..." : "Save admin fields"}</Button>
    </section>
  );
}
