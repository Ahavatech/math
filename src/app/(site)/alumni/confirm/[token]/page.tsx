import Link from "next/link";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { verifyConfirmToken } from "@/lib/alumni-confirm-token";
import { getPeopleYouMightKnow } from "@/server/services/alumni-public";

type Suggestion = {
  id: string;
  fullName: string;
  organisation?: string | null;
  roleOrField?: string | null;
  city?: string | null;
  country?: string | null;
  programmes: { level: string; graduationYear: number }[];
};

function levelLabel(level: string) {
  if (level === "BSC") return "B.Sc.";
  if (level === "MSC") return "M.Sc.";
  return "Ph.D.";
}

function SuggestionCard({ person }: { person: Suggestion }) {
  const prog = person.programmes[0];
  const location = [person.city, person.country].filter(Boolean).join(", ");
  return (
    <li className="rounded-md border border-border p-4 space-y-1">
      <p className="font-medium text-sm">{person.fullName}</p>
      {prog ? (
        <p className="text-xs text-muted-foreground">
          {levelLabel(prog.level)} &rsquo;{String(prog.graduationYear).slice(-2)}
        </p>
      ) : null}
      {person.organisation ? (
        <p className="text-xs text-muted-foreground">{person.organisation}</p>
      ) : null}
      {person.roleOrField ? (
        <p className="text-xs text-muted-foreground">{person.roleOrField}</p>
      ) : null}
      {location ? (
        <p className="text-xs text-muted-foreground">{location}</p>
      ) : null}
    </li>
  );
}

export default async function AlumniConfirmPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const decoded = decodeURIComponent(token);
  const verified = await verifyConfirmToken(decoded, env.AUTH_SECRET);

  if (!verified) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center space-y-4">
        <h1 className="font-heading text-2xl font-semibold">Link expired</h1>
        <p className="text-sm text-muted-foreground">
          This confirmation link is no longer valid. Your submission was still received.
        </p>
        <Link href="/alumni" className="text-sm text-primary underline">
          View the alumni directory
        </Link>
      </div>
    );
  }

  const groups = await getPeopleYouMightKnow(db, verified.entryId);
  const allSuggestions = Object.values(groups).flat() as Suggestion[];
  const unique = Array.from(new Map(allSuggestions.map((s) => [s.id, s])).values());

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 space-y-10">
      <div className="space-y-3">
        <h1 className="font-heading text-2xl font-semibold">Thank you for registering</h1>
        <p className="text-sm text-muted-foreground">
          Your details have been received. The department will review your submission and it will appear
          in the alumni directory once approved.
        </p>
        <Link href="/alumni" className="text-sm text-primary underline">
          View the alumni directory
        </Link>
      </div>

      {unique.length > 0 ? (
        <div className="space-y-4">
          <h2 className="font-heading text-lg font-semibold">People you might know</h2>
          <p className="text-sm text-muted-foreground">
            Fellow alumni from your graduating year who have already joined the directory.
          </p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {unique.map((person) => (
              <SuggestionCard key={person.id} person={person} />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
