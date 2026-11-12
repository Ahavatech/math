import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";

/** A plain notice about the security of someone's account. */
export function SecurityNoticeEmail({
  heading,
  paragraphs,
}: {
  heading: string;
  paragraphs: string[];
}) {
  return (
    <Html>
      <Head />
      <Preview>{heading}</Preview>
      <Body style={{ fontFamily: "sans-serif", backgroundColor: "#ffffff" }}>
        <Container>
          <Heading>{heading}</Heading>
          {paragraphs.map((text) => (
            <Text key={text}>{text}</Text>
          ))}
        </Container>
      </Body>
    </Html>
  );
}

export default SecurityNoticeEmail;
