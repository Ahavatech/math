import { listBoardMembersPublic } from "@/server/services/journal-board";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";

export const revalidate = 300;

export async function generateMetadata() {
  return { title: "Editorial Board" };
}

export default async function EditorialBoardPage() {
  const members = await listBoardMembersPublic();
  const byRole = new Map<string, typeof members>();
  for (const member of members) {
    const list = byRole.get(member.roleTitle) ?? [];
    list.push(member);
    byRole.set(member.roleTitle, list);
  }

  return (
    <Section>
      <Container className="max-w-3xl">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Journal", href: "/journal" }, { label: "Editorial board" }]} />
        <h1 className="mt-4 font-heading text-3xl font-semibold">Editorial board</h1>

        {members.length === 0 ? (
          <p className="mt-4 text-muted-foreground">The editorial board has not been announced yet.</p>
        ) : null}

        {[...byRole.entries()].map(([role, roleMembers]) => (
          <div key={role} className="mt-8">
            <h2 className="font-heading text-xl font-semibold">{role}</h2>
            <ul className="mt-3 space-y-3">
              {roleMembers.map((member) => (
                <li key={member.id} className="text-sm">
                  <p className="font-medium">{member.name}</p>
                  {member.affiliation ? (
                    <p className="text-muted-foreground">
                      {member.affiliation}
                      {member.affiliationCountry ? `, ${member.affiliationCountry}` : ""}
                    </p>
                  ) : null}
                  <div className="flex gap-3 text-xs">
                    {member.orcid ? (
                      <a href={`https://orcid.org/${member.orcid}`} rel="noopener noreferrer" target="_blank" className="text-primary hover:underline">
                        ORCID
                      </a>
                    ) : null}
                    {member.externalUrl ? (
                      <a href={member.externalUrl} rel="noopener noreferrer" target="_blank" className="text-primary hover:underline">
                        Website
                      </a>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Container>
    </Section>
  );
}
