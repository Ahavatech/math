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

interface ReviewerOverdueEmailProps {
  reference: string;
  reviewUrl: string;
  journalName: string;
}

export function ReviewerOverdueEmail({
  reference,
  reviewUrl,
  journalName,
}: ReviewerOverdueEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Overdue review: {reference}</Preview>
      <Body style={{ fontFamily: "sans-serif", backgroundColor: "#ffffff" }}>
        <Container>
          <Heading>Your review is overdue</Heading>
          <Text>
            Your review for {journalName} (reference: {reference}) is now
            overdue. The editorial office would appreciate your earliest
            response.
          </Text>
          <Text>
            <Link href={reviewUrl}>Submit your review now</Link>
          </Text>
          <Text>
            If you are no longer able to complete this review, please notify
            the editorial office immediately so that an alternative reviewer
            can be arranged.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default ReviewerOverdueEmail;
