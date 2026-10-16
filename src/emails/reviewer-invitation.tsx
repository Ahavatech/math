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

interface ReviewerInvitationEmailProps {
  reference: string;
  acceptUrl: string;
  declineUrl: string;
  dueDays: number;
  journalName: string;
}

export function ReviewerInvitationEmail({
  reference,
  acceptUrl,
  declineUrl,
  dueDays,
  journalName,
}: ReviewerInvitationEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Reviewer invitation: {reference}</Preview>
      <Body style={{ fontFamily: "sans-serif", backgroundColor: "#ffffff" }}>
        <Container>
          <Heading>Invitation to review</Heading>
          <Text>
            You have been invited to review a manuscript submitted to{" "}
            <strong>{journalName}</strong> (reference: {reference}).
          </Text>
          <Text>
            If you accept, your review will be due within {dueDays} days. The
            review process is double-blind; please do not attempt to identify
            the authors.
          </Text>
          <Text>
            <Link href={acceptUrl}>Accept this invitation</Link>
          </Text>
          <Text>
            <Link href={declineUrl}>Decline this invitation</Link>
          </Text>
          <Text>
            This invitation link can only be used once and will expire. If you
            have questions, please contact the editorial office.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default ReviewerInvitationEmail;
