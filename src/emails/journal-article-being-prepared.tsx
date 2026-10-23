import { Html, Head, Body, Container, Heading, Text, Section } from "@react-email/components";

interface Props {
  authorName: string;
  title: string;
}

export function ArticleBeingPreparedEmail({ authorName, title }: Props) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: "sans-serif", background: "#f9f9f9" }}>
        <Container style={{ maxWidth: 600, margin: "0 auto", background: "#fff", padding: 32 }}>
          <Heading as="h2" style={{ color: "#1a1a1a" }}>
            Your paper is being prepared for publication
          </Heading>
          <Section>
            <Text>Dear {authorName},</Text>
            <Text>
              We are pleased to inform you that your paper titled <strong>{'"'}{title}{'"'}</strong> has been
              accepted and the editorial team has begun preparing it for publication in the OAU
              Journal of Mathematics.
            </Text>
            <Text>
              You will receive a further notification once the article is live on the journal website.
            </Text>
            <Text>
              If you have any questions, please contact the editorial office.
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
