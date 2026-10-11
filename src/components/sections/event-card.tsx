import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatWAT } from "@/lib/time";

export type EventCardProps = {
  title: string;
  type: string;
  startsAt: Date;
  venue?: string;
  speakerName?: string;
  href: string;
};

export function EventCard({ title, type, startsAt, venue, speakerName, href }: EventCardProps) {
  const day = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", day: "2-digit" }).format(startsAt);
  const month = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", month: "short" }).format(startsAt);
  const time = formatWAT(startsAt, { hour: "2-digit", minute: "2-digit", hour12: false });

  return (
    <Card className="h-full py-4">
      <CardContent className="flex gap-4 px-4">
        <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-md border border-border bg-muted py-2">
          <span className="font-heading text-xl font-semibold leading-none">{day}</span>
          <span className="text-xs tracking-wide text-muted-foreground uppercase">{month}</span>
        </div>
        <div className="min-w-0">
          <Badge variant="secondary" className="mb-1.5 text-xs">
            {type}
          </Badge>
          <h3 className="font-heading text-base leading-snug font-semibold">
            <Link href={href} className="hover:underline">
              {title}
            </Link>
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">{time}</p>
          {venue ? <p className="text-sm text-muted-foreground">{venue}</p> : null}
          {speakerName ? <p className="text-sm text-muted-foreground">{speakerName}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}
