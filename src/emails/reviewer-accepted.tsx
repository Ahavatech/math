import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "@react-email/components";

interface ReviewerAcceptedEmailProps {
  reference: string;
  journalName: string;
}

export function ReviewerAcceptedEmail({
  reference,
  journalName,
}: ReviewerAcceptedEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Reviewer accepted: {reference}</Preview>
      <Body style={{ fontFamily: "sans-serif", backgroundColor: "#ffffff" }}>
        <Container>
          <Heading>Reviewer has accepted</Heading>
          <Text>
            A reviewer has accepted the invitation to review manuscript{" "}
            {reference} for {journalName}.
          </Text>
          <Text>
            You will be notified when the review is submitted.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default ReviewerAcceptedEmail;
