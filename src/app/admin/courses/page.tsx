import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, hasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { listCoursesAdmin } from "@/server/services/courses";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function AdminCoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ programmeLevel?: string; semester?: string; status?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || !user.isActive || !hasPermission(user, "students.manage")) {
    redirect("/403");
  }

  const params = await searchParams;
  const courses = await listCoursesAdmin(db, {
    programmeLevel: params.programmeLevel as "BSC" | "MSC" | "PHD" | undefined,
    semester: params.semester as "FIRST" | "SECOND" | undefined,
    status: params.status as "DRAFT" | "PUBLISHED" | "ARCHIVED" | undefined,
  });

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-lg font-semibold">Courses</h1>
        <div className="flex gap-2">
          <Button render={<Link href="/admin/courses/import">Import CSV</Link>} variant="outline" />
          <Button render={<Link href="/admin/courses/new">New course</Link>} />
        </div>
      </div>

      <form method="get" className="flex flex-wrap gap-2">
        <select name="programmeLevel" defaultValue={params.programmeLevel ?? ""} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="">All programmes</option>
          <option value="BSC">B.Sc.</option>
          <option value="MSC">M.Sc.</option>
          <option value="PHD">Ph.D.</option>
        </select>
        <select name="semester" defaultValue={params.semester ?? ""} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="">Both semesters</option>
          <option value="FIRST">First</option>
          <option value="SECOND">Second</option>
        </select>
        <select name="status" defaultValue={params.status ?? ""} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <button type="submit" className="h-9 rounded-md border border-input px-3 text-sm">Filter</button>
      </form>

      <ul className="space-y-2">
        {courses.map((course) => (
          <li key={course.id} className="flex items-center justify-between gap-4 rounded-md border border-border p-3">
            <div>
              <Link href={`/admin/courses/${course.id}`} className="font-medium hover:underline">
                {course.code} - {course.title}
              </Link>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary">{course.status}</Badge>
                <span>{course.units} units</span>
                <span>Level {course.level}</span>
                <span>{course.semester}</span>
                <span>{course.programmeLevel}</span>
                {course.isElective ? <Badge variant="outline">Elective</Badge> : null}
              </div>
            </div>
          </li>
        ))}
        {courses.length === 0 ? <p className="text-sm text-muted-foreground">No courses match.</p> : null}
      </ul>
    </div>
  );
}
