import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "@react-email/components";

interface ReviewerThankYouEmailProps {
  reference: string;
  journalName: string;
}

export function ReviewerThankYouEmail({
  reference,
  journalName,
}: ReviewerThankYouEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Thank you for your review: {reference}</Preview>
      <Body style={{ fontFamily: "sans-serif", backgroundColor: "#ffffff" }}>
        <Container>
          <Heading>Thank you for your review</Heading>
          <Text>
            Thank you for completing your review of manuscript {reference} for{" "}
            {journalName}. Your contribution to the peer review process is
            greatly appreciated.
          </Text>
          <Text>
            The editorial team will now consider the reviews before making a
            decision.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default ReviewerThankYouEmail;
