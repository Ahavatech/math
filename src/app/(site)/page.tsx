import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Prose } from "@/components/ui/prose";
import { CloudImage } from "@/components/ui/cloud-image";
import { renderRichText } from "@/lib/sanitize-html";
import { NewsCard } from "@/components/sections/news-card";
import { EventCard } from "@/components/sections/event-card";
import { PersonCard } from "@/components/sections/person-card";
import { getHodWelcome, getHomepageHero } from "@/server/services/site-content";
import { getHomepageStats } from "@/server/services/stats";
import {
  listResearchAreas,
  listLatestNews,
  listUpcomingEvents,
  getFeaturedLecturer,
  getFeaturedAlumni,
  getHeroImage,
} from "@/server/services/homepage";
import Link from "next/link";
import { db } from "@/lib/db";
import { rankLabel } from "@/lib/lecturer-rank";

export default async function Home() {
  const [hero, hod, stats, researchAreas, news, events, lecturer, alumni] = await Promise.all([
    getHomepageHero(),
    getHodWelcome(),
    getHomepageStats(db),
    listResearchAreas(),
    listLatestNews(),
    listUpcomingEvents(),
    getFeaturedLecturer(),
    getFeaturedAlumni(),
  ]);
  const heroImage = await getHeroImage(hero.imageId);

  return (
    <>
      {hero.heading ? (
        <Section className="py-14 sm:py-20">
          <Container className="grid gap-8 lg:grid-cols-2 lg:items-center">
            <div>
              <h1 className="font-heading text-4xl font-semibold sm:text-5xl">{hero.heading}</h1>
              {hero.subheading ? (
                <p className="mt-4 text-lg text-muted-foreground">{hero.subheading}</p>
              ) : null}
              {hero.ctaLabel && hero.ctaHref ? (
                <Button className="mt-6" nativeButton={false} render={<Link href={hero.ctaHref} />}>
                  {hero.ctaLabel}
                </Button>
              ) : null}
            </div>
            {heroImage ? (
              <div className="relative aspect-video overflow-hidden rounded-xl">
                <CloudImage
                  src={heroImage.url}
                  alt={heroImage.alt ?? ""}
                  fill
                  priority
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-cover"
                />
              </div>
            ) : null}
          </Container>
        </Section>
      ) : null}

      {hod.name && hod.message ? (
        <Section>
          <Container className="max-w-3xl text-center">
            <p className="text-sm font-medium tracking-wide text-primary uppercase">
              A welcome from the Head of Department
            </p>
            <Prose
              className="mt-4 text-left [&>*:first-child]:mt-0 line-clamp-6"
              dangerouslySetInnerHTML={{ __html: renderRichText(hod.message) }}
            />
            <p className="mt-4 font-heading font-semibold">{hod.name}</p>
            {hod.title ? <p className="text-sm text-muted-foreground">{hod.title}</p> : null}
            <Button
              variant="outline"
              className="mt-4"
              nativeButton={false}
              render={<Link href="/about" />}
            >
              Read the full address
            </Button>
          </Container>
        </Section>
      ) : null}

      <Section className="bg-muted/40">
        <Container className="grid grid-cols-2 gap-6 text-center sm:grid-cols-4">
          <StatBlock label="Academic staff" value={stats.staff.value} />
          <StatBlock label="Programmes" value={stats.programmes.value} />
          <StatBlock label="Research areas" value={stats.researchAreas.value} />
          <StatBlock label="Alumni" value={stats.alumni.value} />
        </Container>
      </Section>

      {researchAreas.length > 0 ? (
        <Section>
          <Container>
            <div className="flex items-baseline justify-between">
              <h2 className="font-heading text-2xl font-semibold">Research areas</h2>
              <Link href="/research" className="text-sm text-primary hover:underline">
                View all
              </Link>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {researchAreas.map((area) => (
                <Link key={area.id} href={`/research/${area.slug}`} className="block">
                  <Card className="h-full py-4 transition-colors hover:border-primary/40">
                    <CardContent className="px-4">
                      <h3 className="font-heading font-semibold">{area.title}</h3>
                      {area.summary ? (
                        <p className="mt-2 text-sm text-muted-foreground">{area.summary}</p>
                      ) : null}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </Container>
        </Section>
      ) : null}

      {news.length > 0 ? (
        <Section>
          <Container>
            <div className="flex items-baseline justify-between">
              <h2 className="font-heading text-2xl font-semibold">Latest news</h2>
              <Link href="/news" className="text-sm text-primary hover:underline">
                View all
              </Link>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {news.map((post) => (
                <NewsCard
                  key={post.id}
                  title={post.title}
                  excerpt={post.excerpt ?? undefined}
                  category={post.category}
                  publishedAt={post.publishedAt ?? post.createdAt}
                  href={`/news/${post.slug}`}
                />
              ))}
            </div>
          </Container>
        </Section>
      ) : null}

      {events.length > 0 ? (
        <Section>
          <Container>
            <div className="flex items-baseline justify-between">
              <h2 className="font-heading text-2xl font-semibold">Upcoming events</h2>
              <Link href="/events" className="text-sm text-primary hover:underline">
                View all
              </Link>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {events.map((event) => (
                <EventCard
                  key={event.id}
                  title={event.title}
                  type={event.type}
                  startsAt={event.startsAt}
                  venue={event.venue ?? undefined}
                  href={`/events/${event.slug}`}
                />
              ))}
            </div>
          </Container>
        </Section>
      ) : null}

      {lecturer ? (
        <Section>
          <Container>
            <h2 className="font-heading text-2xl font-semibold">Featured lecturer</h2>
            <div className="mt-6 max-w-xs">
              <PersonCard
                name={`${lecturer.honorific ? lecturer.honorific + " " : ""}${lecturer.fullName}`}
                rank={rankLabel(lecturer.rank)}
                photoUrl={lecturer.photo?.url}
                href={`/lecturer/${lecturer.slug}`}
              />
            </div>
          </Container>
        </Section>
      ) : null}

      {alumni.length > 0 ? (
        <Section>
          <Container>
            <h2 className="font-heading text-2xl font-semibold">Featured alumni</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {alumni.map((entry) => (
                <Card key={entry.id} className="h-full py-4">
                  <CardContent className="px-4">
                    <h3 className="font-heading font-semibold">{entry.fullName}</h3>
                    <p className="text-sm text-muted-foreground">
                      {entry.roleTitle ? `${entry.roleTitle}, ` : ""}
                      {entry.organisation ?? ""}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">Class of {entry.graduationYear}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </Container>
        </Section>
      ) : null}
    </>
  );
}

function StatBlock({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="font-heading text-3xl font-semibold">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
