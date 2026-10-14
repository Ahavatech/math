import { redirect, notFound } from "next/navigation";
import { getCurrentUser, hasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { getCourseByIdAdmin } from "@/server/services/courses";
import { CourseForm } from "../course-form";

export default async function EditCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.isActive || !hasPermission(user, "students.manage")) {
    redirect("/403");
  }

  const { id } = await params;
  let course;
  try {
    course = await getCourseByIdAdmin(db, id);
  } catch {
    notFound();
  }

  const [allCourses, lecturers] = await Promise.all([
    db.course.findMany({ select: { id: true, code: true, title: true }, orderBy: { code: "asc" } }),
    db.lecturerProfile.findMany({ where: { status: "PUBLISHED" }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" } }),
  ]);

  return (
    <CourseForm
      course={course}
      allCourses={allCourses.map((c) => ({ id: c.id, label: `${c.code} - ${c.title}` }))}
      lecturers={lecturers.map((l) => ({ id: l.id, label: l.fullName }))}
      initialPrerequisiteIds={course.prerequisites.map((p) => p.id)}
      initialLecturerIds={course.lecturers.map((l) => l.id)}
    />
  );
}
