import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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

export function PersonCard({ name, rank, photoUrl, href, researchAreas }: PersonCardProps) {
  return (
    <Link href={href} className="block">
      <Card className="h-full py-4 transition-colors hover:border-primary/40">
        <CardContent className="flex flex-col items-center gap-3 px-4 text-center">
          <Avatar className="size-20">
            {photoUrl ? <AvatarImage src={photoUrl} alt="" /> : null}
            <AvatarFallback className="font-heading text-lg">{initials(name)}</AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-heading font-semibold leading-snug">{name}</h3>
            <p className="text-sm text-muted-foreground">{rank}</p>
          </div>
          {researchAreas && researchAreas.length > 0 ? (
            <div className="flex flex-wrap justify-center gap-1">
              {researchAreas.slice(0, 3).map((area) => (
                <Badge key={area} variant="secondary">
                  {area}
                </Badge>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </Link>
  );
}
