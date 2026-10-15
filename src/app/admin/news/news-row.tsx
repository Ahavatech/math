"use client";

import { useTransition } from "react";
import Link from "next/link";
import type { MediaAsset, NewsPost } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { setNewsPostStatusAction } from "@/server/actions/news";

export function NewsRow({ post, needsReview }: { post: NewsPost & { cover: MediaAsset | null }; needsReview: boolean }) {
  const [pending, startTransition] = useTransition();

  function setStatus(status: "DRAFT" | "PUBLISHED" | "ARCHIVED") {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", post.id);
      fd.set("status", status);
      await setNewsPostStatusAction(fd);
      window.location.reload();
    });
  }

  return (
    <li className="flex items-center justify-between gap-4 rounded-md border border-border p-3">
      <div>
        <Link href={`/admin/news/${post.id}`} className="font-medium hover:underline">
          {post.title}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary">{post.category}</Badge>
          <Badge variant="secondary">{post.status}</Badge>
          {post.isPinned ? <Badge>Pinned</Badge> : null}
          {post.publishedAt && post.publishedAt > new Date() ? <Badge variant="outline">Scheduled</Badge> : null}
          {needsReview ? <Badge variant="outline">Imported from the old site, needs HOD review</Badge> : null}
          {post.publishedAt ? <span>{post.publishedAt.toLocaleDateString()}</span> : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {post.status === "ARCHIVED" ? (
          <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => setStatus("DRAFT")}>
            Restore
          </Button>
        ) : (
          <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => setStatus("ARCHIVED")}>
            Archive
          </Button>
        )}
        {post.status === "PUBLISHED" ? (
          <a href={`/news/${post.slug}`} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">
            View public
          </a>
        ) : null}
      </div>
    </li>
  );
}
