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

interface ReviewerReminderEmailProps {
  reference: string;
  reviewUrl: string;
  dueDate: string;
  journalName: string;
}

export function ReviewerReminderEmail({
  reference,
  reviewUrl,
  dueDate,
  journalName,
}: ReviewerReminderEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Review reminder: {reference}</Preview>
      <Body style={{ fontFamily: "sans-serif", backgroundColor: "#ffffff" }}>
        <Container>
          <Heading>Reminder: review due soon</Heading>
          <Text>
            This is a reminder that your review for {journalName} (reference:{" "}
            {reference}) is due on <strong>{dueDate}</strong>.
          </Text>
          <Text>
            <Link href={reviewUrl}>Submit your review</Link>
          </Text>
          <Text>
            If you are unable to complete the review, please contact the
            editorial office as soon as possible.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default ReviewerReminderEmail;
