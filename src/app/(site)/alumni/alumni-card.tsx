import Link from "next/link";
import type { AlumniEntry, MediaAsset } from "@prisma/client";
import { CloudImage } from "@/components/ui/cloud-image";
import { Card, CardContent } from "@/components/ui/card";
import { alumniPublicReference } from "@/lib/alumni-reference";

type PublicAlumniEntry = Pick<
  AlumniEntry,
  "id" | "fullName" | "level" | "graduationYear" | "organisation" | "roleTitle" | "city" | "country" | "linkedinUrl"
> & { photo: Pick<MediaAsset, "id" | "url" | "alt"> | null };

export function AlumniCard({ entry }: { entry: PublicAlumniEntry }) {
  const location = [entry.city, entry.country].filter(Boolean).join(", ");
  const ref = alumniPublicReference(entry.id);

  return (
    <Card className="h-full py-4">
      <CardContent className="space-y-2 px-4">
        {entry.photo ? (
          <div className="relative size-16 overflow-hidden rounded-full">
            <CloudImage
              src={entry.photo.url}
              alt={`Photo of ${entry.fullName}`}
              fill
              sizes="64px"
              className="object-cover"
            />
          </div>
        ) : null}
        <h3 className="font-heading font-semibold">{entry.fullName}</h3>
        <p className="text-xs text-muted-foreground">
          {entry.level === "BSC" ? "B.Sc." : "M.Sc."}, Class of {entry.graduationYear}
        </p>
        {entry.roleTitle || entry.organisation ? (
          <p className="text-sm text-muted-foreground">
            {entry.roleTitle ? `${entry.roleTitle}` : ""}
            {entry.roleTitle && entry.organisation ? " at " : ""}
            {entry.organisation ?? ""}
          </p>
        ) : null}
        {location ? <p className="text-xs text-muted-foreground">{location}</p> : null}
        {entry.linkedinUrl ? (
          <a href={entry.linkedinUrl} target="_blank" rel="noopener noreferrer" className="block text-sm text-primary underline">
            LinkedIn
          </a>
        ) : null}
        <Link href={`/contact?type=ALUMNI&ref=${ref}`} className="block text-xs text-muted-foreground underline">
          Request correction or removal
        </Link>
      </CardContent>
    </Card>
  );
}
