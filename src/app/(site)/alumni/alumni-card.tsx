import Link from "next/link";
import type { MediaAsset } from "@prisma/client";
import { CloudImage } from "@/components/ui/cloud-image";
import { alumniPublicReference } from "@/lib/alumni-reference";

type Programme = { level: "BSC" | "MSC" | "PHD"; graduationYear: number };

export type PublicAlumniEntry = {
  id: string;
  fullName: string;
  organisation: string | null;
  roleOrField: string | null;
  city: string | null;
  country: string | null;
  note: string | null;
  programmes: Programme[];
  photo: Pick<MediaAsset, "id" | "url" | "alt"> | null;
};

function levelLabel(level: "BSC" | "MSC" | "PHD"): string {
  if (level === "BSC") return "B.Sc.";
  if (level === "MSC") return "M.Sc.";
  return "Ph.D.";
}

export function AlumniCard({ entry }: { entry: PublicAlumniEntry }) {
  const location = [entry.city, entry.country].filter(Boolean).join(", ");
  const ref = alumniPublicReference(entry.id);
  const primaryProg = entry.programmes[0];

  return (
    <article className="h-full border-t border-border py-4">
      <div className="space-y-1.5">
        {entry.photo ? (
          <div className="relative size-16 overflow-hidden border border-border">
            <CloudImage
              src={entry.photo.url}
              alt={`Photo of ${entry.fullName}`}
              fill
              sizes="64px"
              className="object-cover"
            />
          </div>
        ) : null}
        <h3 className="font-heading text-lg font-semibold">{entry.fullName}</h3>
        {primaryProg ? (
          <p className="tabular text-sm font-medium text-accent">
            {levelLabel(primaryProg.level)}, Class of {primaryProg.graduationYear}
          </p>
        ) : null}
        {entry.roleOrField || entry.organisation ? (
          <p className="text-muted-foreground">
            {entry.roleOrField ? `${entry.roleOrField}` : ""}
            {entry.roleOrField && entry.organisation ? " at " : ""}
            {entry.organisation ?? ""}
          </p>
        ) : null}
        {entry.note ? <p className="text-sm text-muted-foreground italic">{entry.note}</p> : null}
        {location ? <p className="text-sm text-muted-foreground">{location}</p> : null}
        <Link href={`/contact?type=ALUMNI&ref=${ref}`} className="link-rule inline-block py-1.5 text-sm text-muted-foreground hover:text-foreground">
          Request correction or removal
        </Link>
      </div>
    </article>
  );
}
