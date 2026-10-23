import { Html, Head, Body, Container, Heading, Text, Section, Link } from "@react-email/components";

interface Props {
  title: string;
  slug: string;
}

export function ArticlePublishedEmail({ title, slug }: Props) {
  const url = `https://maths.oauife.edu.ng/journal/articles/${slug}`;

  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: "sans-serif", background: "#f9f9f9" }}>
        <Container style={{ maxWidth: 600, margin: "0 auto", background: "#fff", padding: 32 }}>
          <Heading as="h2" style={{ color: "#1a1a1a" }}>
            Your paper is now published
          </Heading>
          <Section>
            <Text>
              We are delighted to inform you that your paper titled <strong>"{title}"</strong> is
              now published in the OAU Journal of Mathematics and is available online.
            </Text>
            <Text>
              <Link href={url}>View your article online</Link>
            </Text>
            <Text>
              Congratulations on this achievement. We hope your work will contribute significantly
              to the field.
            </Text>
            <Text style={{ marginTop: 32 }}>
              Regards,
              <br />
              The OAU Journal of Mathematics Editorial Team
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
