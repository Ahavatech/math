import { Body, Container, Head, Heading, Html, Link, Preview, Text } from "@react-email/components";

export function JournalReturnedToAuthorEmail({
  reference,
  signInUrl,
}: {
  reference: string;
  signInUrl: string;
}) {
  return (
    <Html>
      <Head />
      <Preview>Action required for your submission ({reference})</Preview>
      <Body style={{ fontFamily: "sans-serif", backgroundColor: "#ffffff" }}>
        <Container>
          <Heading>Action required on your submission</Heading>
          <Text>
            Your submission ({reference}) to the OAU Journal of Mathematics has been
            returned to you with comments from the editorial team.
          </Text>
          <Text>
            Please sign in to your account to view the feedback and upload a revised version.
          </Text>
          <Text>
            <Link href={signInUrl}>Sign in to view feedback</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default JournalReturnedToAuthorEmail;
