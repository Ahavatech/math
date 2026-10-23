import Link from "next/link";
import type { MediaAsset } from "@prisma/client";
import { CloudImage } from "@/components/ui/cloud-image";
import { Card, CardContent } from "@/components/ui/card";
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
        {primaryProg ? (
          <p className="text-xs text-muted-foreground">
            {levelLabel(primaryProg.level)}, Class of {primaryProg.graduationYear}
          </p>
        ) : null}
        {entry.roleOrField || entry.organisation ? (
          <p className="text-sm text-muted-foreground">
            {entry.roleOrField ? `${entry.roleOrField}` : ""}
            {entry.roleOrField && entry.organisation ? " at " : ""}
            {entry.organisation ?? ""}
          </p>
        ) : null}
        {entry.note ? <p className="text-xs text-muted-foreground italic">{entry.note}</p> : null}
        {location ? <p className="text-xs text-muted-foreground">{location}</p> : null}
        <Link href={`/contact?type=ALUMNI&ref=${ref}`} className="block text-xs text-muted-foreground underline">
          Request correction or removal
        </Link>
      </CardContent>
    </Card>
  );
}
