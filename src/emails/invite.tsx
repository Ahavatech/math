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

export function InviteEmail({ name, acceptUrl }: { name: string; acceptUrl: string }) {
  return (
    <Html>
      <Head />
      <Preview>You have been invited to the OAU Mathematics site</Preview>
      <Body style={{ fontFamily: "sans-serif", backgroundColor: "#ffffff" }}>
        <Container>
          <Heading>Welcome, {name}</Heading>
          <Text>
            The Department of Mathematics has created an account for you on the
            department website. Use the link below to set your password and get
            started.
          </Text>
          <Text>
            <Link href={acceptUrl}>Set your password</Link>
          </Text>
          <Text>This link expires in 7 days and can only be used once.</Text>
          <Text>If you did not expect this invitation, you can ignore this email.</Text>
        </Container>
      </Body>
    </Html>
  );
}

export default InviteEmail;
