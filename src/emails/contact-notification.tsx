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

export function ContactNotificationEmail({
  senderName,
  type,
  adminUrl,
}: {
  senderName: string;
  type: string;
  adminUrl: string;
}) {
  return (
    <Html>
      <Head />
      <Preview>New contact message</Preview>
      <Body style={{ fontFamily: "sans-serif", backgroundColor: "#ffffff" }}>
        <Container>
          <Heading>New contact message</Heading>
          <Text>
            {senderName} sent a {type.toLowerCase()} message through the department website.
          </Text>
          <Text>
            <Link href={adminUrl}>Open the message</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default ContactNotificationEmail;
