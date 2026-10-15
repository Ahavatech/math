"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { NavItem, NavLocation } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createNavItemAction,
  deleteNavItemAction,
  toggleNavItemVisibilityAction,
  reorderNavItemAction,
  updateNavItemAction,
} from "@/server/actions/navigation";
import { ArrowUp, ArrowDown, Trash2 } from "lucide-react";

function topLevel(items: NavItem[]) {
  return items.filter((i) => !i.parentId);
}
function childrenOf(items: NavItem[], parentId: string) {
  return items.filter((i) => i.parentId === parentId);
}

function NavRow({
  item,
  depth,
  onChanged,
}: {
  item: NavItem;
  depth: number;
  onChanged: () => void;
}) {
  const [label, setLabel] = useState(item.label);
  const [href, setHref] = useState(item.href);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", item.id);
      formData.set("label", label);
      formData.set("href", href);
      const result = await updateNavItemAction(undefined, formData);
      if (result.error) setError(result.error);
      else onChanged();
    });
  }

  async function act(fn: (fd: FormData) => Promise<void>, extra?: Record<string, string>) {
    const formData = new FormData();
    formData.set("id", item.id);
    if (extra) for (const [k, v] of Object.entries(extra)) formData.set(k, v);
    await fn(formData);
    onChanged();
  }

  return (
    <div className="space-y-1" style={{ marginLeft: depth * 24 }}>
      <div className="flex items-center gap-2">
        <Input value={label} onChange={(e) => setLabel(e.target.value)} className="w-40" />
        <Input value={href} onChange={(e) => setHref(e.target.value)} className="flex-1" />
        <Button size="icon-sm" variant="outline" onClick={() => act(reorderNavItemAction, { direction: "up" })} aria-label="Move up">
          <ArrowUp className="size-4" />
        </Button>
        <Button size="icon-sm" variant="outline" onClick={() => act(reorderNavItemAction, { direction: "down" })} aria-label="Move down">
          <ArrowDown className="size-4" />
        </Button>
        <Button size="sm" variant="outline" onClick={() => act((fd) => toggleNavItemVisibilityAction(fd), { isVisible: String(!item.isVisible) })}>
          {item.isVisible ? "Visible" : "Hidden"}
        </Button>
        <Button size="sm" onClick={save} disabled={pending}>
          Save
        </Button>
        <Button size="icon-sm" variant="destructive" onClick={() => act(deleteNavItemAction)} aria-label="Delete">
          <Trash2 className="size-4" />
        </Button>
      </div>
      {error ? (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function NavSection({
  title,
  location,
  items,
}: {
  title: string;
  location: NavLocation;
  items: NavItem[];
}) {
  const router = useRouter();
  const [newLabel, setNewLabel] = useState("");
  const [newHref, setNewHref] = useState("");
  const [parentId, setParentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleAdd() {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("label", newLabel);
      formData.set("href", newHref);
      formData.set("location", location);
      formData.set("parentId", parentId);
      const result = await createNavItemAction(undefined, formData);
      if (result.error) setError(result.error);
      else {
        setNewLabel("");
        setNewHref("");
        router.refresh();
      }
    });
  }

  const tops = topLevel(items);

  return (
    <section className="space-y-3">
      <h2 className="font-heading text-xl font-semibold">{title}</h2>
      <div className="space-y-2">
        {tops.map((item) => (
          <div key={item.id}>
            <NavRow item={item} depth={0} onChanged={() => router.refresh()} />
            {childrenOf(items, item.id).map((child) => (
              <NavRow key={child.id} item={child} depth={1} onChanged={() => router.refresh()} />
            ))}
          </div>
        ))}
      </div>

      <div className="flex items-end gap-2 border-t border-border pt-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Label</label>
          <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Link</label>
          <Input value={newHref} onChange={(e) => setNewHref(e.target.value)} placeholder="/about" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Parent (optional)</label>
          <select
            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
          >
            <option value="">Top level</option>
            {tops.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <Button onClick={handleAdd} disabled={pending || !newLabel || !newHref}>
          Add item
        </Button>
      </div>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
