import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Download, ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { getPublishedPage, getStudentAssociation } from "@/server/services/site-content";
import { listHandbookTreePublic } from "@/server/services/handbook";
import { listCoursesPublic } from "@/server/services/courses";
import { listCalendarEntriesPublic } from "@/server/services/academic-calendar";
import { listDownloadsPublic } from "@/server/services/downloads";
import { renderRichText } from "@/lib/sanitize-html";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageHeader } from "@/components/ui/page-header";
import { Prose } from "@/components/ui/prose";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Students",
};

export default async function StudentsHubPage() {
  const [page, handbookTree, { courses }, calendarEntries, downloads, association, handbookDownload] = await Promise.all([
    getPublishedPage("students-intro"),
    listHandbookTreePublic(db),
    listCoursesPublic(db, {}),
    listCalendarEntriesPublic(db),
    listDownloadsPublic(db),
    getStudentAssociation(),
    db.download.findFirst({ where: { category: "HANDBOOK", status: "PUBLISHED" }, orderBy: { updatedAt: "desc" } }).catch(() => null),
  ]);

  const sections = [
    { title: "Course catalogue", href: "/students/courses", visible: courses.length > 0, description: "Browse courses by programme, level and semester." },
    { title: "Academic calendar", href: "/students/calendar", visible: calendarEntries.length > 0, description: "Key dates for the academic session." },
    { title: "Student handbook", href: "/students/handbook", visible: handbookTree.length > 0, description: "Policies, procedures and everything you need to know." },
    { title: "Downloads and forms", href: "/students/downloads", visible: downloads.length > 0, description: "Forms, guidelines and other documents." },
  ].filter((c) => c.visible);

  return (
    <Section>
      <Container>
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Students" }]} />
        <PageHeader className="mt-4" title="Students" />

        <div className="mt-8 grid gap-10 lg:grid-cols-[3fr_2fr] lg:gap-14">
          <div>
            {page ? (
              <Prose dangerouslySetInnerHTML={{ __html: renderRichText(page.body) }} />
            ) : (
              <p className="max-w-[60ch] text-lg text-muted-foreground">
                Courses, dates, the handbook and forms for students of the department.
              </p>
            )}
          </div>

          {
            <nav aria-label="Student resources">
              <ul className="border-b border-border">
                {sections.map((section) => (
                  <li key={section.href} className="index-row border-t border-border">
                    <Link
                      href={section.href}
                      className="flex min-h-20 items-center justify-between gap-4 py-4"
                    >
                      <span>
                        <span className="block font-heading text-xl font-semibold">
                          {section.title}
                        </span>
                        <span className="mt-0.5 block text-muted-foreground">
                          {section.description}
                        </span>
                      </span>
                      <ArrowRight
                        className="row-arrow size-5 shrink-0 text-accent"
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                ))}
                <li className="index-row border-t border-border">
                  <a
                    href={handbookDownload?.fileUrl ?? "/documents/department-handbook.pdf"}
                    download
                    className="flex min-h-20 items-center justify-between gap-4 py-4"
                  >
                    <span>
                      <span className="block font-heading text-xl font-semibold">Download the handbook</span>
                      <span className="mt-0.5 block text-muted-foreground">
                        {handbookDownload?.description || "The Department of Mathematics Handbook, 2019 to 2022 (PDF)."}
                      </span>
                    </span>
                    <Download className="row-arrow size-5 shrink-0 text-accent" aria-hidden="true" />
                  </a>
                </li>
                {association.url ? (
                  <li className="index-row border-t border-border">
                    <a
                      href={association.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-20 items-center justify-between gap-4 py-4"
                    >
                      <span>
                        <span className="block font-heading text-xl font-semibold">
                          {association.label || "Student association"}
                        </span>
                        <span className="mt-0.5 block text-muted-foreground">
                          {association.description || association.url.replace(/^https:\/\//, "")}
                        </span>
                        <span className="sr-only"> (opens in a new tab)</span>
                      </span>
                      <ExternalLink className="row-arrow size-5 shrink-0 text-accent" aria-hidden="true" />
                    </a>
                  </li>
                ) : null}
              </ul>
            </nav>
          }
        </div>

        <p className="mt-12 border-t border-border pt-5">
          <Link href="/programmes" className="link-rule py-2 font-medium text-primary">
            See our B.Sc., M.Sc. and Ph.D. programmes
          </Link>
        </p>
      </Container>
    </Section>
  );
}
