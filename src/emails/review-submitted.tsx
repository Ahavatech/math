import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from "@react-email/components";

interface ReviewSubmittedEmailProps {
  reference: string;
  manuscriptUrl: string;
  journalName: string;
}

export function ReviewSubmittedEmail({
  reference,
  manuscriptUrl,
  journalName,
}: ReviewSubmittedEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Review submitted: {reference}</Preview>
      <Body style={{ fontFamily: "sans-serif", backgroundColor: "#ffffff" }}>
        <Container>
          <Heading>Review submitted</Heading>
          <Text>
            A reviewer has submitted their review for manuscript {reference} in{" "}
            {journalName}.
          </Text>
          <Text>
            <Link href={manuscriptUrl}>View the manuscript and reviews</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default ReviewSubmittedEmail;
