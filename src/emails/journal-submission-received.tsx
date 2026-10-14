import { Body, Container, Head, Heading, Html, Link, Preview, Text } from "@react-email/components";

export function JournalSubmissionReceivedEmail({
  reference,
  signInUrl,
}: {
  reference: string;
  signInUrl: string;
}) {
  return (
    <Html>
      <Head />
      <Preview>Your submission has been received ({reference})</Preview>
      <Body style={{ fontFamily: "sans-serif", backgroundColor: "#ffffff" }}>
        <Container>
          <Heading>Submission received</Heading>
          <Text>
            We have received your submission to the OAU Journal of Mathematics. Your reference
            number is <strong>{reference}</strong>.
          </Text>
          <Text>
            You can track the status of your submission by signing in to your account.
          </Text>
          <Text>
            <Link href={signInUrl}>Sign in to your account</Link>
          </Text>
          <Text>Please keep your reference number for future correspondence.</Text>
        </Container>
      </Body>
    </Html>
  );
}

export default JournalSubmissionReceivedEmail;
