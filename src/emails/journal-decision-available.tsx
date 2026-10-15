import { Body, Container, Head, Heading, Html, Link, Preview, Text } from "@react-email/components";

export function JournalDecisionAvailableEmail({
  reference,
  signInUrl,
}: {
  reference: string;
  signInUrl: string;
}) {
  return (
    <Html>
      <Head />
      <Preview>A decision is available for your submission ({reference})</Preview>
      <Body style={{ fontFamily: "sans-serif", backgroundColor: "#ffffff" }}>
        <Container>
          <Heading>Decision available</Heading>
          <Text>
            A decision has been made on your submission ({reference}) to the OAU Journal
            of Mathematics.
          </Text>
          <Text>Please sign in to your account to view the editorial decision.</Text>
          <Text>
            <Link href={signInUrl}>Sign in to view decision</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default JournalDecisionAvailableEmail;
