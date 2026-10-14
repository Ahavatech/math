import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { getPublishedPage } from "@/server/services/site-content";
import { listHandbookTreePublic } from "@/server/services/handbook";
import { listCoursesPublic } from "@/server/services/courses";
import { listCalendarEntriesPublic } from "@/server/services/academic-calendar";
import { listDownloadsPublic } from "@/server/services/downloads";
import { renderRichText } from "@/lib/sanitize-html";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Prose } from "@/components/ui/prose";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Students",
};

export default async function StudentsHubPage() {
  const [page, handbookTree, { courses }, calendarEntries, downloads] = await Promise.all([
    getPublishedPage("students-intro"),
    listHandbookTreePublic(db),
    listCoursesPublic(db, {}),
    listCalendarEntriesPublic(db),
    listDownloadsPublic(db),
  ]);

  const cards = [
    { title: "Student Handbook", href: "/students/handbook", visible: handbookTree.length > 0, description: "Policies, procedures and everything you need to know." },
    { title: "Course Catalogue", href: "/students/courses", visible: courses.length > 0, description: "Browse courses by programme, level and semester." },
    { title: "Academic Calendar", href: "/students/calendar", visible: calendarEntries.length > 0, description: "Key dates for the academic session." },
    { title: "Downloads", href: "/students/downloads", visible: downloads.length > 0, description: "Forms, guidelines and other documents." },
  ].filter((c) => c.visible);

  return (
    <Section>
      <Container className="max-w-3xl">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Students" }]} />
        <h1 className="mt-4 font-heading text-3xl font-semibold sm:text-4xl">Students</h1>

        {page ? (
          <Prose className="mt-4" dangerouslySetInnerHTML={{ __html: renderRichText(page.body) }} />
        ) : null}

        {cards.length > 0 ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {cards.map((card) => (
              <Link key={card.href} href={card.href}>
                <Card className="h-full transition-colors hover:border-primary">
                  <CardHeader>
                    <CardTitle>{card.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">{card.description}</CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : null}

        <div className="mt-10 border-t border-border pt-6 text-sm text-muted-foreground">
          <Link href="/programmes" className="text-primary hover:underline">
            See our B.Sc., M.Sc. and Ph.D. programmes
          </Link>
        </div>
      </Container>
    </Section>
  );
}
