import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, hasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { listNewsPostsAdmin } from "@/server/services/news";
import { Button } from "@/components/ui/button";
import { NewsRow } from "./news-row";

export default async function AdminNewsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; category?: string; q?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || !user.isActive || !hasPermission(user, "news.manage")) {
    redirect("/403");
  }

  const params = await searchParams;
  const allPosts = await listNewsPostsAdmin(db);
  const posts = allPosts.filter((post) => {
    if (params.status && post.status !== params.status) return false;
    if (params.category && post.category !== params.category) return false;
    if (params.q && !post.title.toLowerCase().includes(params.q.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-lg font-semibold">News</h1>
        <Button render={<Link href="/admin/news/new">New post</Link>} />
      </div>

      <form method="get" className="flex flex-wrap gap-2">
        <input
          type="search"
          name="q"
          defaultValue={params.q}
          placeholder="Search by title"
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        />
        <select name="status" defaultValue={params.status ?? ""} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <select name="category" defaultValue={params.category ?? ""} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="">All categories</option>
          <option value="ANNOUNCEMENT">Announcement</option>
          <option value="ACHIEVEMENT">Achievement</option>
          <option value="ADMISSION">Admission</option>
          <option value="RESEARCH">Research</option>
        </select>
        <Button type="submit" variant="outline" size="sm">Filter</Button>
      </form>

      <ul className="space-y-2">
        {posts.map((post) => (
          <NewsRow key={post.id} post={post} />
        ))}
        {posts.length === 0 ? <p className="text-sm text-muted-foreground">No posts match.</p> : null}
      </ul>
    </div>
  );
}
