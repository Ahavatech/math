import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { PageHeader } from "@/components/ui/page-header";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Prose } from "@/components/ui/prose";
import { EmptyState } from "@/components/ui/empty-state";
import { Math } from "@/components/ui/math";
import { NewsCard } from "@/components/sections/news-card";
import { EventCard } from "@/components/sections/event-card";
import { PersonCard } from "@/components/sections/person-card";
import { Inbox } from "lucide-react";

const TOKEN_SWATCHES = [
  { name: "background", label: "Background" },
  { name: "foreground", label: "Foreground" },
  { name: "card", label: "Card" },
  { name: "muted", label: "Muted" },
  { name: "muted-foreground", label: "Muted foreground" },
  { name: "border", label: "Border" },
  { name: "primary", label: "Primary (chalkboard)" },
  { name: "accent", label: "Accent (chalk dust)" },
  { name: "destructive", label: "Destructive" },
] as const;

export default function DesignPreviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <Container>
      <Section className="space-y-16">
        <PageHeader
          title="Design preview"
          description="Every token and component in realistic states. Dev-only — this route 404s in production."
        />

        <section aria-labelledby="colors-heading" className="space-y-4">
          <h2 id="colors-heading" className="font-heading text-2xl font-semibold">
            Colour tokens
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {TOKEN_SWATCHES.map((token) => (
              <div key={token.name} className="space-y-2">
                <div
                  className="h-16 rounded-md border border-border"
                  style={{ backgroundColor: `var(--${token.name})` }}
                />
                <p className="text-xs text-muted-foreground">{token.label}</p>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="type-heading" className="space-y-4">
          <h2 id="type-heading" className="font-heading text-2xl font-semibold">
            Typography
          </h2>
          <div className="space-y-3">
            <p className="font-heading text-5xl font-semibold">Hero title 5xl</p>
            <p className="font-heading text-4xl font-semibold">Page title 4xl</p>
            <p className="font-heading text-3xl font-semibold">Subheading 3xl</p>
            <p className="font-heading text-2xl font-semibold">Section heading 2xl</p>
            <p className="font-heading text-xl font-semibold">Card title xl</p>
            <p className="text-lg">Lead paragraph lg</p>
            <p className="text-base">
              Body text base. The quick brown fox jumps over the lazy dog, used here at full
              measure to check line length and readability across a realistic paragraph.
            </p>
            <p className="text-sm text-muted-foreground">Caption / metadata sm</p>
            <p className="text-xs text-muted-foreground">Fine print xs</p>
          </div>
          <div className="space-y-2 border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">
              Glyph check (Yoruba diacritics - dot-below, underdot, tone marks):
            </p>
            <p className="font-heading text-2xl font-semibold">
              Ọlá Adéṣọlá, Ẹ̀bùn Ṣóyẹmí, Àjàyí Òkúnọlá
            </p>
            <p className="text-lg">Ọlá Adéṣọlá, Ẹ̀bùn Ṣóyẹmí, Àjàyí Òkúnọlá</p>
          </div>
        </section>

        <section aria-labelledby="buttons-heading" className="space-y-4">
          <h2 id="buttons-heading" className="font-heading text-2xl font-semibold">
            Buttons
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <Button>Default</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="link">Link</Button>
            <Button disabled>Disabled</Button>
          </div>
        </section>

        <section aria-labelledby="badges-heading" className="space-y-4">
          <h2 id="badges-heading" className="font-heading text-2xl font-semibold">
            Badges
          </h2>
          <div className="flex flex-wrap gap-2">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="destructive">Destructive</Badge>
          </div>
        </section>

        <section aria-labelledby="alerts-heading" className="space-y-4">
          <h2 id="alerts-heading" className="font-heading text-2xl font-semibold">
            Alerts
          </h2>
          <Alert>
            <AlertTitle>Heads up</AlertTitle>
            <AlertDescription>A neutral informational alert.</AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription>A destructive alert for errors.</AlertDescription>
          </Alert>
        </section>

        <section aria-labelledby="breadcrumbs-heading" className="space-y-4">
          <h2 id="breadcrumbs-heading" className="font-heading text-2xl font-semibold">
            Breadcrumbs
          </h2>
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Research", href: "/research" },
              { label: "Graph Theory and Combinatorics" },
            ]}
          />
        </section>

        <section aria-labelledby="cards-heading" className="space-y-4">
          <h2 id="cards-heading" className="font-heading text-2xl font-semibold">
            Cards
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader>
                <CardTitle>Base card</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Plain card content.
              </CardContent>
            </Card>
            <NewsCard
              title="[SAMPLE] Department hosts annual mathematics colloquium"
              excerpt="A short excerpt of the news story goes here, trimmed to two lines."
              category="Announcement"
              publishedAt={new Date("2026-03-04")}
              href="#"
            />
            <EventCard
              title="[SAMPLE] Seminar: Graph colouring and applications"
              type="Seminar"
              startsAt={new Date("2026-04-12T14:00:00")}
              venue="Mathematics Lecture Theatre"
              href="#"
            />
            <PersonCard name="[SAMPLE] Dr. Jane Doe" rank="Senior Lecturer" href="#" />
          </div>
        </section>

        <section aria-labelledby="empty-heading" className="space-y-4">
          <h2 id="empty-heading" className="font-heading text-2xl font-semibold">
            Empty state
          </h2>
          <EmptyState
            icon={Inbox}
            title="No events yet"
            description="When the department schedules an event, it will appear here."
            action={<Button size="sm">Create event</Button>}
          />
        </section>

        <section aria-labelledby="skeleton-heading" className="space-y-4">
          <h2 id="skeleton-heading" className="font-heading text-2xl font-semibold">
            Skeleton
          </h2>
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-24 w-full" />
          </div>
        </section>

        <section aria-labelledby="prose-heading" className="space-y-4">
          <h2 id="prose-heading" className="font-heading text-2xl font-semibold">
            Prose
          </h2>
          <Prose>
            <h2>A sample page heading</h2>
            <p>
              This is a paragraph of body copy rendered through the Prose wrapper, used for
              rich-text page bodies such as About pages and news articles.
            </p>
            <ul>
              <li>A bulleted list item</li>
              <li>Another list item</li>
            </ul>
            <blockquote>A block quotation, set apart with a left rule.</blockquote>
          </Prose>
        </section>

        <section aria-labelledby="math-heading" className="space-y-4">
          <h2 id="math-heading" className="font-heading text-2xl font-semibold">
            Math (KaTeX)
          </h2>
          <p className="text-sm">
            Inline: the quadratic formula is <Math>{"x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}"}</Math>.
          </p>
          <Math display>{"\\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi}"}</Math>
        </section>
      </Section>
    </Container>
  );
}
