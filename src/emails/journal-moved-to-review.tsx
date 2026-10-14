import { Body, Container, Head, Heading, Html, Link, Preview, Text } from "@react-email/components";

export function JournalMovedToReviewEmail({
  reference,
  signInUrl,
}: {
  reference: string;
  signInUrl: string;
}) {
  return (
    <Html>
      <Head />
      <Preview>Your submission is now in peer review ({reference})</Preview>
      <Body style={{ fontFamily: "sans-serif", backgroundColor: "#ffffff" }}>
        <Container>
          <Heading>Your submission is now in peer review</Heading>
          <Text>
            Your submission ({reference}) to the OAU Journal of Mathematics has passed
            initial screening and is now undergoing peer review.
          </Text>
          <Text>You will be notified when a decision is available.</Text>
          <Text>
            <Link href={signInUrl}>Sign in to view submission status</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default JournalMovedToReviewEmail;
