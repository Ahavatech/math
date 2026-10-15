import { Body, Container, Head, Heading, Html, Link, Preview, Text } from "@react-email/components";

export function JournalNewSubmissionEditorsEmail({
  reference,
  manuscriptUrl,
}: {
  reference: string;
  manuscriptUrl: string;
}) {
  return (
    <Html>
      <Head />
      <Preview>New submission received: {reference}</Preview>
      <Body style={{ fontFamily: "sans-serif", backgroundColor: "#ffffff" }}>
        <Container>
          <Heading>New submission received</Heading>
          <Text>
            A new manuscript has been submitted to the OAU Journal of Mathematics.
            Reference: <strong>{reference}</strong>.
          </Text>
          <Text>
            <Link href={manuscriptUrl}>Review submission in the editorial system</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default JournalNewSubmissionEditorsEmail;
