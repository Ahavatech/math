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

interface RevisionReceivedEmailProps {
  reference: string;
  round: number;
  manuscriptUrl: string;
  journalName: string;
}

export function RevisionReceivedEmail({
  reference,
  round,
  manuscriptUrl,
  journalName,
}: RevisionReceivedEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Revision received: {reference}</Preview>
      <Body style={{ fontFamily: "sans-serif", backgroundColor: "#ffffff" }}>
        <Container>
          <Heading>Revised manuscript received</Heading>
          <Text>
            A revised manuscript (round {round}) has been received for{" "}
            {reference} in {journalName}.
          </Text>
          <Text>
            <Link href={manuscriptUrl}>View the revised manuscript</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default RevisionReceivedEmail;
