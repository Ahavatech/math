"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Event, EventGalleryImage, EventSeries, MediaAsset } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { MediaPicker, type SelectedMedia } from "@/components/admin/media-picker";
import { VersionHistoryDialog } from "@/components/admin/version-history-dialog";
import { GalleryManager } from "./gallery-manager";
import {
  createEventAction,
  updateEventAction,
  listEventRevisionsAction,
  restoreEventAction,
  duplicateEventAction,
} from "@/server/actions/events";
import { utcToWatLocalInput } from "@/lib/time";

type ExistingEvent = Event & {
  flyer: MediaAsset | null;
  series: EventSeries | null;
  galleryImages?: (EventGalleryImage & { media: MediaAsset })[];
};

export function EventForm({
  event,
  existingMedia,
  allSeries,
}: {
  event: ExistingEvent | null;
  existingMedia: MediaAsset[];
  allSeries: EventSeries[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState(event?.title ?? "");
  const [slug, setSlug] = useState(event?.slug ?? "");
  const [type, setType] = useState(event?.type ?? "SEMINAR");
  const [startsAt, setStartsAt] = useState(event?.startsAt ? utcToWatLocalInput(event.startsAt) : "");
  const [endsAt, setEndsAt] = useState(event?.endsAt ? utcToWatLocalInput(event.endsAt) : "");
  const [venue, setVenue] = useState(event?.venue ?? "");
  const [speakerName, setSpeakerName] = useState(event?.speakerName ?? "");
  const [speakerAffiliation, setSpeakerAffiliation] = useState(event?.speakerAffiliation ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [flyer, setFlyer] = useState<SelectedMedia | null>(
    event?.flyer ? { id: event.flyer.id, url: event.flyer.url, alt: event.flyer.alt ?? "" } : null,
  );
  const [registrationUrl, setRegistrationUrl] = useState(event?.registrationUrl ?? "");
  const [slidesUrl, setSlidesUrl] = useState(event?.slidesUrl ?? "");
  const [recordingUrl, setRecordingUrl] = useState(event?.recordingUrl ?? "");
  const [seriesId, setSeriesId] = useState(event?.seriesId ?? "");
  const [status, setStatus] = useState(event?.status ?? "DRAFT");
  const [dirty, setDirty] = useState(false);
  const [result, setResult] = useState<{ error?: string; success?: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (dirty) e.preventDefault();
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function save() {
    setResult(null);
    startTransition(async () => {
      const fd = new FormData();
      if (event) fd.set("id", event.id);
      fd.set("title", title);
      fd.set("slug", slug);
      fd.set("type", type);
      fd.set("startsAt", startsAt);
      if (endsAt) fd.set("endsAt", endsAt);
      fd.set("venue", venue);
      fd.set("speakerName", speakerName);
      fd.set("speakerAffiliation", speakerAffiliation);
      fd.set("description", description);
      fd.set("flyerId", flyer?.id ?? "");
      fd.set("registrationUrl", registrationUrl);
      fd.set("slidesUrl", slidesUrl);
      fd.set("recordingUrl", recordingUrl);
      if (seriesId) fd.set("seriesId", seriesId);
      fd.set("status", status);
      const action = event ? updateEventAction : createEventAction;
      const res = await action(undefined, fd);
      setResult(res);
      if (!res.error) {
        setDirty(false);
        if (!event && res.id) router.push(`/admin/events/${res.id}`);
      }
    });
  }

  function duplicate() {
    if (!event) return;
    startTransition(async () => {
      const res = await duplicateEventAction((() => { const fd = new FormData(); fd.set("id", event.id); return fd; })());
      if (res.id) router.push(`/admin/events/${res.id}`);
    });
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-lg font-semibold">{event ? event.title : "New event"}</h1>
        <div className="flex gap-2">
          {event ? (
            <>
              <Button type="button" size="sm" variant="outline" onClick={duplicate} disabled={pending}>
                Duplicate event
              </Button>
              <VersionHistoryDialog
                listRevisions={() => listEventRevisionsAction(event.id)}
                onRestore={async (revisionId) => {
                  const fd = new FormData();
                  fd.set("id", event.id);
                  fd.set("revisionId", revisionId);
                  await restoreEventAction(fd);
                }}
              />
            </>
          ) : null}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="event-title">Title</Label>
        <Input id="event-title" value={title} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="event-slug">Slug {event?.status === "PUBLISHED" ? "(changing it redirects the old address)" : ""}</Label>
        <Input id="event-slug" value={slug} onChange={(e) => { setSlug(e.target.value); setDirty(true); }} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="event-type">Type</Label>
          <select id="event-type" className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={type} onChange={(e) => { setType(e.target.value as typeof type); setDirty(true); }}>
            <option value="SEMINAR">Seminar</option>
            <option value="COLLOQUIUM">Colloquium</option>
            <option value="SPECIAL_LECTURE">Special lecture</option>
            <option value="CONFERENCE">Conference</option>
            <option value="GRADUATION">Graduation</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="event-status">Status</Label>
          <select id="event-status" className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={status} onChange={(e) => { setStatus(e.target.value as typeof status); setDirty(true); }}>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="event-starts">Starts (WAT)</Label>
          <Input id="event-starts" type="datetime-local" value={startsAt} onChange={(e) => { setStartsAt(e.target.value); setDirty(true); }} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="event-ends">Ends (WAT, optional)</Label>
          <Input id="event-ends" type="datetime-local" value={endsAt} onChange={(e) => { setEndsAt(e.target.value); setDirty(true); }} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="event-venue">Venue</Label>
        <Input id="event-venue" value={venue} onChange={(e) => { setVenue(e.target.value); setDirty(true); }} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="event-speaker">Speaker name</Label>
          <Input id="event-speaker" value={speakerName} onChange={(e) => { setSpeakerName(e.target.value); setDirty(true); }} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="event-affiliation">Speaker affiliation</Label>
          <Input id="event-affiliation" value={speakerAffiliation} onChange={(e) => { setSpeakerAffiliation(e.target.value); setDirty(true); }} />
        </div>
      </div>

      <MediaPicker folder="events" existing={existingMedia} value={flyer} onChange={(m) => { setFlyer(m); setDirty(true); }} label="Flyer" />

      <div className="space-y-1.5">
        <Label>Description</Label>
        <RichTextEditor initialHtml={description} existingMedia={existingMedia} onChange={(html) => { setDescription(html); setDirty(true); }} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="event-registration">Registration URL (https only)</Label>
          <Input id="event-registration" value={registrationUrl} onChange={(e) => { setRegistrationUrl(e.target.value); setDirty(true); }} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="event-slides">Slides URL (https only)</Label>
          <Input id="event-slides" value={slidesUrl} onChange={(e) => { setSlidesUrl(e.target.value); setDirty(true); }} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="event-recording">Recording URL (https only)</Label>
          <Input id="event-recording" value={recordingUrl} onChange={(e) => { setRecordingUrl(e.target.value); setDirty(true); }} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="event-series">Series (optional)</Label>
        <select id="event-series" className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={seriesId} onChange={(e) => { setSeriesId(e.target.value); setDirty(true); }}>
          <option value="">No series</option>
          {allSeries.map((s) => (
            <option key={s.id} value={s.id}>{s.title}</option>
          ))}
        </select>
        <Link href="/admin/events/series" className="text-xs text-primary underline">Manage series</Link>
      </div>

      {event?.status === "DRAFT" ? (
        <a href={`/events/${event.slug}`} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">
          View as public (preview)
        </a>
      ) : null}

      {result?.error ? <Alert variant="destructive"><AlertDescription>{result.error}</AlertDescription></Alert> : null}
      {result?.success ? <Alert><AlertDescription>Saved.</AlertDescription></Alert> : null}
      {dirty && !result?.success ? <p className="text-xs text-muted-foreground">You have unsaved changes.</p> : null}

      <Button onClick={save} disabled={pending || !title.trim() || !slug.trim() || !startsAt}>
        {pending ? "Saving..." : "Save"}
      </Button>

      {event ? (
        <div className="border-t border-border pt-4">
          <GalleryManager eventId={event.id} images={event.galleryImages ?? []} />
        </div>
      ) : null}
    </div>
  );
}
