import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "@react-email/components";

interface ReviewerDeclinedEmailProps {
  reference: string;
  journalName: string;
}

export function ReviewerDeclinedEmail({
  reference,
  journalName,
}: ReviewerDeclinedEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Reviewer declined: {reference}</Preview>
      <Body style={{ fontFamily: "sans-serif", backgroundColor: "#ffffff" }}>
        <Container>
          <Heading>Reviewer has declined</Heading>
          <Text>
            A reviewer has declined the invitation to review manuscript{" "}
            {reference} for {journalName}.
          </Text>
          <Text>
            You may need to invite an alternative reviewer for this manuscript.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default ReviewerDeclinedEmail;
