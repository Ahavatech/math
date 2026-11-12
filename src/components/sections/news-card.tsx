import Link from "next/link";
import { humanise } from "@/lib/labels";
import { CloudImage } from "@/components/ui/cloud-image";

export type NewsCardProps = {
  title: string;
  excerpt?: string;
  category: string;
  publishedAt: Date;
  href: string;
  pinned?: boolean;
  coverUrl?: string;
  coverAlt?: string;
};

/**
 * A news item set as a ruled list row, not a card: date in the margin
 * column, headline and standfirst beside it, an optional small cover.
 */
export function NewsCard({
  title,
  excerpt,
  category,
  publishedAt,
  href,
  pinned,
  coverUrl,
  coverAlt,
}: NewsCardProps) {
  const day = publishedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const year = publishedAt.getFullYear();

  return (
    <article className="index-row grid grid-cols-[4.5rem_1fr] gap-x-4 border-t border-border py-5 sm:grid-cols-[6rem_1fr]">
      <time
        dateTime={publishedAt.toISOString()}
        className="tabular pt-1 text-sm leading-snug text-muted-foreground"
      >
        <span className="block font-semibold text-foreground">{day}</span>
        {year}
      </time>
      <div className="flex min-w-0 gap-5">
        <div className="min-w-0 flex-1">
          <h3 className="font-heading text-xl leading-snug font-semibold">
            <Link href={href} className="link-rule after:absolute after:inset-0">
              {title}
            </Link>
          </h3>
          {excerpt ? (
            <p className="mt-2 line-clamp-2 max-w-[62ch] text-muted-foreground">{excerpt}</p>
          ) : null}
          <p className="mt-2 text-sm text-muted-foreground">
            {pinned ? <span className="font-semibold text-accent">Pinned. </span> : null}
            {humanise(category)}
          </p>
        </div>
        {coverUrl ? (
          <div className="relative hidden size-24 shrink-0 overflow-hidden border border-border sm:block">
            <CloudImage
              src={coverUrl}
              alt={coverAlt ?? ""}
              fill
              sizes="96px"
              className="object-cover"
            />
          </div>
        ) : null}
      </div>
    </article>
  );
}
