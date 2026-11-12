import { listBoardMembersPublic } from "@/server/services/journal-board";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageHeader } from "@/components/ui/page-header";

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
      <Container>
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Journal", href: "/journal" }, { label: "Editorial board" }]} />
        <PageHeader className="mt-4" title="Editorial board" />

        {members.length === 0 ? (
          <p className="mt-8 border-t border-border py-5 text-muted-foreground">
            The editorial board has not been announced yet.
          </p>
        ) : null}

        {[...byRole.entries()].map(([role, roleMembers]) => (
          <section key={role} className="mt-10">
            <h2 className="border-b-2 border-foreground pb-2 font-heading text-2xl font-semibold">{role}</h2>
            <ul className="grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
              {roleMembers.map((member) => (
                <li key={member.id} className="border-b border-border py-4">
                  <p className="font-heading text-lg font-semibold">{member.name}</p>
                  {member.affiliation ? (
                    <p className="text-muted-foreground">
                      {member.affiliation}
                      {member.affiliationCountry ? `, ${member.affiliationCountry}` : ""}
                    </p>
                  ) : null}
                  <div className="mt-1 flex gap-4">
                    {member.orcid ? (
                      <a href={`https://orcid.org/${member.orcid}`} rel="noopener noreferrer" target="_blank" className="link-rule py-1 text-sm font-medium text-primary">
                        ORCID
                      </a>
                    ) : null}
                    {member.externalUrl ? (
                      <a href={member.externalUrl} rel="noopener noreferrer" target="_blank" className="link-rule py-1 text-sm font-medium text-primary">
                        Website
                      </a>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </Container>
    </Section>
  );
}
