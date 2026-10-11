"use client";

import { useState, useTransition } from "react";
import type { Publication } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  createPublicationAction,
  updatePublicationAction,
  deletePublicationAction,
  reorderPublicationAction,
} from "@/server/actions/lecturers";

type EditableFields = {
  title: string;
  authorsText: string;
  venue: string;
  year: string;
  url: string;
  doi: string;
};

const EMPTY_FIELDS: EditableFields = { title: "", authorsText: "", venue: "", year: "", url: "", doi: "" };

export function PublicationsManager({ publications }: { publications: Publication[] }) {
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [fields, setFields] = useState<EditableFields>(EMPTY_FIELDS);
  const [pending, startTransition] = useTransition();

  function startEdit(pub: Publication) {
    setEditingId(pub.id);
    setAdding(false);
    setError(null);
    setFields({
      title: pub.title,
      authorsText: pub.authorsText,
      venue: pub.venue ?? "",
      year: String(pub.year),
      url: pub.url ?? "",
      doi: pub.doi ?? "",
    });
  }

  function startAdd() {
    setAdding(true);
    setEditingId(null);
    setError(null);
    setFields(EMPTY_FIELDS);
  }

  function cancel() {
    setAdding(false);
    setEditingId(null);
    setError(null);
  }

  function toFormData() {
    const fd = new FormData();
    fd.set("title", fields.title);
    fd.set("authorsText", fields.authorsText);
    fd.set("venue", fields.venue);
    fd.set("year", fields.year);
    fd.set("url", fields.url);
    fd.set("doi", fields.doi);
    return fd;
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const fd = toFormData();
      const result = editingId
        ? (fd.set("id", editingId), await updatePublicationAction(fd))
        : await createPublicationAction(fd);
      if (result.error) {
        setError(result.error);
        return;
      }
      cancel();
      window.location.reload();
    });
  }

  function remove(id: string) {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", id);
      const result = await deletePublicationAction(fd);
      if (result.error) {
        setError(result.error);
        return;
      }
      window.location.reload();
    });
  }

  function move(id: string, direction: "up" | "down") {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", id);
      fd.set("direction", direction);
      const result = await reorderPublicationAction(fd);
      if (result.error) {
        setError(result.error);
        return;
      }
      window.location.reload();
    });
  }

  return (
    <div className="space-y-3">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <ul className="space-y-2">
        {publications.map((pub, i) => (
          <li key={pub.id} className="rounded-md border border-border p-3 text-sm">
            {editingId === pub.id ? (
              <PublicationForm fields={fields} setFields={setFields} onSave={save} onCancel={cancel} pending={pending} />
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{pub.title}</p>
                  <p className="text-muted-foreground">
                    {pub.authorsText} {pub.venue ? `- ${pub.venue}` : ""} ({pub.year})
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button type="button" size="sm" variant="ghost" disabled={i === 0 || pending} onClick={() => move(pub.id, "up")}>
                    Up
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={i === publications.length - 1 || pending}
                    onClick={() => move(pub.id, "down")}
                  >
                    Down
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => startEdit(pub)}>
                    Edit
                  </Button>
                  <Button type="button" size="sm" variant="destructive" disabled={pending} onClick={() => remove(pub.id)}>
                    Remove
                  </Button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>

      {adding ? (
        <div className="rounded-md border border-border p-3">
          <PublicationForm fields={fields} setFields={setFields} onSave={save} onCancel={cancel} pending={pending} />
        </div>
      ) : publications.length < 200 ? (
        <Button type="button" variant="outline" size="sm" onClick={startAdd}>
          Add publication
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">You have reached the 200-publication limit.</p>
      )}
    </div>
  );
}

function PublicationForm({
  fields,
  setFields,
  onSave,
  onCancel,
  pending,
}: {
  fields: EditableFields;
  setFields: (fields: EditableFields) => void;
  onSave: () => void;
  onCancel: () => void;
  pending: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="space-y-1.5">
        <Label>Title</Label>
        <Input value={fields.title} onChange={(e) => setFields({ ...fields, title: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label>Authors</Label>
        <Input value={fields.authorsText} onChange={(e) => setFields({ ...fields, authorsText: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label>Venue</Label>
          <Input value={fields.venue} onChange={(e) => setFields({ ...fields, venue: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Year</Label>
          <Input type="number" value={fields.year} onChange={(e) => setFields({ ...fields, year: e.target.value })} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label>URL (https only)</Label>
          <Input value={fields.url} onChange={(e) => setFields({ ...fields, url: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>DOI</Label>
          <Input value={fields.doi} onChange={(e) => setFields({ ...fields, doi: e.target.value })} placeholder="10.xxxx/..." />
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="button" size="sm" disabled={pending} onClick={onSave}>
          {pending ? "Saving..." : "Save"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
