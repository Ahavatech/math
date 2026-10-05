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

export function PasswordResetEmail({ resetUrl }: { resetUrl: string }) {
  return (
    <Html>
      <Head />
      <Preview>Reset your password</Preview>
      <Body style={{ fontFamily: "sans-serif", backgroundColor: "#ffffff" }}>
        <Container>
          <Heading>Reset your password</Heading>
          <Text>
            We received a request to reset the password for your account on the
            Department of Mathematics website. Use the link below to choose a new
            password.
          </Text>
          <Text>
            <Link href={resetUrl}>Reset your password</Link>
          </Text>
          <Text>This link expires in 1 hour and can only be used once.</Text>
          <Text>If you did not request this, you can ignore this email.</Text>
        </Container>
      </Body>
    </Html>
  );
}

export default PasswordResetEmail;
