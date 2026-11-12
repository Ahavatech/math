import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export type PersonCardProps = {
  name: string;
  rank: string;
  photoUrl?: string;
  href: string;
  researchAreas?: string[];
};

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * A staff entry as a flat index entry: portrait square, name, rank and
 * research areas, with the whole row a single link named by the person.
 */
export function PersonCard({ name, rank, photoUrl, href, researchAreas }: PersonCardProps) {
  return (
    <article className="index-row relative flex h-full gap-4 border-t border-border py-4">
      <Avatar className="size-16 shrink-0 rounded-none after:rounded-none">
        {photoUrl ? <AvatarImage src={photoUrl} alt="" className="rounded-none" /> : null}
        <AvatarFallback className="rounded-none bg-secondary font-heading text-lg">
          {initials(name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <h3 className="font-heading text-lg leading-snug font-semibold">
          <Link href={href} className="link-rule after:absolute after:inset-0">
            {name}
          </Link>
        </h3>
        <p className="text-sm text-muted-foreground">{rank}</p>
        {researchAreas && researchAreas.length > 0 ? (
          <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
            {researchAreas.slice(0, 3).join(", ")}
          </p>
        ) : null}
      </div>
    </article>
  );
}
