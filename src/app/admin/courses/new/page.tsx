import { redirect } from "next/navigation";
import { getCurrentUser, hasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { CourseForm } from "../course-form";

export default async function NewCoursePage() {
  const user = await getCurrentUser();
  if (!user || !user.isActive || !hasPermission(user, "students.manage")) {
    redirect("/403");
  }

  const [allCourses, lecturers] = await Promise.all([
    db.course.findMany({ select: { id: true, code: true, title: true }, orderBy: { code: "asc" } }),
    db.lecturerProfile.findMany({ where: { status: "PUBLISHED" }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" } }),
  ]);

  return (
    <CourseForm
      course={null}
      allCourses={allCourses.map((c) => ({ id: c.id, label: `${c.code} - ${c.title}` }))}
      lecturers={lecturers.map((l) => ({ id: l.id, label: l.fullName }))}
      initialPrerequisiteIds={[]}
      initialLecturerIds={[]}
    />
  );
}
