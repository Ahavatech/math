import Link from "next/link";
import { formatWAT } from "@/lib/time";
import { humanise } from "@/lib/labels";

export type EventCardProps = {
  title: string;
  type: string;
  startsAt: Date;
  venue?: string;
  speakerName?: string;
  href: string;
};

/** An event as a ruled list row: the day in red serif, details beside it. */
export function EventCard({ title, type, startsAt, venue, speakerName, href }: EventCardProps) {
  const day = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", day: "numeric" }).format(startsAt);
  const month = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", month: "short" }).format(startsAt);
  const time = formatWAT(startsAt, { hour: "2-digit", minute: "2-digit", hour12: false });

  return (
    <article className="index-row grid grid-cols-[4.5rem_1fr] gap-x-4 border-t border-border py-5">
      <div className="tabular leading-none">
        <span className="block font-heading text-4xl font-semibold text-accent">{day}</span>
        <span className="mt-1 block text-sm font-medium text-muted-foreground">{month}</span>
      </div>
      <div className="min-w-0">
        <h3 className="font-heading text-lg leading-snug font-semibold">
          <Link href={href} className="link-rule after:absolute after:inset-0">
            {title}
          </Link>
        </h3>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {humanise(type)}, {time}
          {venue ? `, ${venue}` : ""}
        </p>
        {speakerName ? <p className="text-sm text-muted-foreground">{speakerName}</p> : null}
      </div>
    </article>
  );
}
