"use client";

import { useState, useTransition } from "react";
import type { Specialisation } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowUp, ArrowDown, Trash2, RotateCcw } from "lucide-react";
import {
  createSpecialisationAction,
  updateSpecialisationAction,
  setSpecialisationActiveAction,
  reorderSpecialisationAction,
} from "@/server/actions/programmes";

function SpecialisationRow({ spec }: { spec: Specialisation }) {
  const [title, setTitle] = useState(spec.title);
  const [description, setDescription] = useState(spec.description);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", spec.id);
      fd.set("title", title);
      fd.set("description", description);
      await updateSpecialisationAction(fd);
    });
  }

  function move(direction: "up" | "down") {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", spec.id);
      fd.set("direction", direction);
      await reorderSpecialisationAction(fd);
      window.location.reload();
    });
  }

  function toggleActive() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", spec.id);
      fd.set("isActive", spec.isActive ? "false" : "true");
      await setSpecialisationActiveAction(fd);
      window.location.reload();
    });
  }

  return (
    <li className={`space-y-2 rounded-md border border-border p-3 ${spec.isActive ? "" : "opacity-60"}`}>
      <div className="flex items-center gap-2">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} className="flex-1" />
        <Button type="button" variant="ghost" size="icon" onClick={() => move("up")} disabled={pending}>
          <ArrowUp className="size-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" onClick={() => move("down")} disabled={pending}>
          <ArrowDown className="size-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" onClick={toggleActive} disabled={pending}>
          {spec.isActive ? <Trash2 className="size-4" /> : <RotateCcw className="size-4" />}
        </Button>
      </div>
      <Input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description"
      />
      <div className="flex items-center gap-2">
        {!spec.isActive ? <span className="text-xs text-muted-foreground">Archived</span> : null}
        <Button type="button" size="sm" variant="outline" onClick={save} disabled={pending}>
          Save
        </Button>
      </div>
    </li>
  );
}

export function SpecialisationsManager({
  programmeId,
  specialisations,
}: {
  programmeId: string;
  specialisations: Specialisation[];
}) {
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [pending, startTransition] = useTransition();

  function addSpecialisation() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("programmeId", programmeId);
      fd.set("title", newTitle);
      fd.set("description", newDescription);
      await createSpecialisationAction(fd);
      setNewTitle("");
      setNewDescription("");
      window.location.reload();
    });
  }

  return (
    <section className="space-y-4">
      <h2 className="font-heading text-base font-semibold">Specialisations</h2>
      <ul className="space-y-3">
        {specialisations.map((spec) => (
          <SpecialisationRow key={spec.id} spec={spec} />
        ))}
        {specialisations.length === 0 ? (
          <p className="text-sm text-muted-foreground">No specialisations yet.</p>
        ) : null}
      </ul>
      <div className="space-y-2 rounded-md border border-dashed border-border p-3">
        <Label htmlFor="new-spec-title">Add a specialisation</Label>
        <Input
          id="new-spec-title"
          placeholder="Title"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
        />
        <Input
          placeholder="Description"
          value={newDescription}
          onChange={(e) => setNewDescription(e.target.value)}
        />
        <Button type="button" size="sm" onClick={addSpecialisation} disabled={pending || !newTitle.trim()}>
          Add
        </Button>
      </div>
    </section>
  );
}
