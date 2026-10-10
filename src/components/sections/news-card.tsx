import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export type NewsCardProps = {
  title: string;
  excerpt?: string;
  category: string;
  publishedAt: Date;
  href: string;
};

export function NewsCard({ title, excerpt, category, publishedAt, href }: NewsCardProps) {
  return (
    <Card className="h-full py-4">
      <CardHeader className="gap-2 px-4">
        <Badge variant="secondary" className="w-fit text-xs">
          {category}
        </Badge>
        <h3 className="font-heading text-lg leading-snug font-semibold">
          <Link href={href} className="hover:underline">
            {title}
          </Link>
        </h3>
      </CardHeader>
      <CardContent className="px-4">
        {excerpt ? <p className="text-sm text-muted-foreground">{excerpt}</p> : null}
        <time dateTime={publishedAt.toISOString()} className="mt-3 block text-xs text-muted-foreground">
          {publishedAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
        </time>
      </CardContent>
    </Card>
  );
}
