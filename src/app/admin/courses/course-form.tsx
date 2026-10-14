"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Course } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { VersionHistoryDialog } from "@/components/admin/version-history-dialog";
import { createCourseAction, updateCourseAction, listCourseRevisionsAction, restoreCourseAction } from "@/server/actions/courses";

type SelectOption = { id: string; label: string };

export function CourseForm({
  course,
  allCourses,
  lecturers,
  initialPrerequisiteIds,
  initialLecturerIds,
}: {
  course: Course | null;
  allCourses: SelectOption[];
  lecturers: SelectOption[];
  initialPrerequisiteIds: string[];
  initialLecturerIds: string[];
}) {
  const router = useRouter();
  const [code, setCode] = useState(course?.code ?? "");
  const [title, setTitle] = useState(course?.title ?? "");
  const [units, setUnits] = useState(course?.units ?? 3);
  const [level, setLevel] = useState(course?.level ?? 100);
  const [semester, setSemester] = useState(course?.semester ?? "FIRST");
  const [programmeLevel, setProgrammeLevel] = useState(course?.programmeLevel ?? "BSC");
  const [isElective, setIsElective] = useState(course?.isElective ?? false);
  const [description, setDescription] = useState(course?.description ?? "");
  const [status, setStatus] = useState(course?.status ?? "DRAFT");
  const [prerequisiteIds, setPrerequisiteIds] = useState<string[]>(initialPrerequisiteIds);
  const [lecturerIds, setLecturerIds] = useState<string[]>(initialLecturerIds);
  const [result, setResult] = useState<{ error?: string; success?: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(list: string[], setList: (v: string[]) => void, id: string) {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  function save() {
    setResult(null);
    startTransition(async () => {
      const fd = new FormData();
      if (course) fd.set("id", course.id);
      fd.set("code", code);
      fd.set("title", title);
      fd.set("units", String(units));
      fd.set("level", String(level));
      fd.set("semester", semester);
      fd.set("programmeLevel", programmeLevel);
      fd.set("isElective", String(isElective));
      fd.set("description", description);
      fd.set("status", status);
      for (const id of prerequisiteIds) fd.append("prerequisiteIds", id);
      for (const id of lecturerIds) fd.append("lecturerIds", id);
      const action = course ? updateCourseAction : createCourseAction;
      const res = await action(undefined, fd);
      setResult(res);
      if (!res.error && !course && res.id) router.push(`/admin/courses/${res.id}`);
    });
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-lg font-semibold">{course ? course.code : "New course"}</h1>
        {course ? (
          <VersionHistoryDialog
            listRevisions={() => listCourseRevisionsAction(course.id)}
            onRestore={async (revisionId) => {
              const fd = new FormData();
              fd.set("id", course.id);
              fd.set("revisionId", revisionId);
              await restoreCourseAction(fd);
              window.location.reload();
            }}
          />
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="code">Code</Label>
          <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. MTH 101" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="title">Title</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="units">Units</Label>
          <Input id="units" type="number" min={1} max={12} value={units} onChange={(e) => setUnits(Number(e.target.value))} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="level">Level</Label>
          <Input id="level" type="number" min={100} max={900} step={100} value={level} onChange={(e) => setLevel(Number(e.target.value))} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="semester">Semester</Label>
          <select id="semester" value={semester} onChange={(e) => setSemester(e.target.value as typeof semester)} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
            <option value="FIRST">First</option>
            <option value="SECOND">Second</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="programmeLevel">Programme</Label>
          <select id="programmeLevel" value={programmeLevel} onChange={(e) => setProgrammeLevel(e.target.value as typeof programmeLevel)} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
            <option value="BSC">B.Sc.</option>
            <option value="MSC">M.Sc.</option>
            <option value="PHD">Ph.D.</option>
          </select>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isElective} onChange={(e) => setIsElective(e.target.checked)} />
        Elective
      </label>

      <div className="space-y-1.5">
        <Label>Description</Label>
        <RichTextEditor initialHtml={description} onChange={setDescription} existingMedia={[]} />
      </div>

      <div className="space-y-1.5">
        <Label>Prerequisites</Label>
        <div className="max-h-40 overflow-y-auto rounded-md border border-border p-2 text-sm">
          {allCourses.filter((c) => c.id !== course?.id).map((c) => (
            <label key={c.id} className="flex items-center gap-2 py-0.5">
              <input type="checkbox" checked={prerequisiteIds.includes(c.id)} onChange={() => toggle(prerequisiteIds, setPrerequisiteIds, c.id)} />
              {c.label}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Lecturers</Label>
        <div className="max-h-40 overflow-y-auto rounded-md border border-border p-2 text-sm">
          {lecturers.map((l) => (
            <label key={l.id} className="flex items-center gap-2 py-0.5">
              <input type="checkbox" checked={lecturerIds.includes(l.id)} onChange={() => toggle(lecturerIds, setLecturerIds, l.id)} />
              {l.label}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="status">Status</Label>
        <select id="status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
          <option value="ARCHIVED">Archived</option>
        </select>
      </div>

      {result?.error ? <p className="text-sm text-destructive" role="alert">{result.error}</p> : null}
      <Button type="button" onClick={save} disabled={pending}>
        {pending ? "Saving..." : "Save"}
      </Button>
    </div>
  );
}
