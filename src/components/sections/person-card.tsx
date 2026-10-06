import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";

export type PersonCardProps = {
  name: string;
  rank: string;
  photoUrl?: string;
  href: string;
};

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function PersonCard({ name, rank, photoUrl, href }: PersonCardProps) {
  return (
    <Link href={href} className="block">
      <Card className="h-full py-4 transition-colors hover:border-primary/40">
        <CardContent className="flex flex-col items-center gap-3 px-4 text-center">
          <Avatar className="size-20">
            {photoUrl ? <AvatarImage src={photoUrl} alt="" /> : null}
            <AvatarFallback className="font-heading text-lg">{initials(name)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-heading font-semibold leading-snug">{name}</p>
            <p className="text-sm text-muted-foreground">{rank}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
