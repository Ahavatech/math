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

export function JournalVerifyEmail({ verifyUrl }: { verifyUrl: string }) {
  return (
    <Html>
      <Head />
      <Preview>Verify your email address for journal submissions</Preview>
      <Body style={{ fontFamily: "sans-serif", backgroundColor: "#ffffff" }}>
        <Container>
          <Heading>Verify your email address</Heading>
          <Text>
            Thank you for registering to submit to the OAU Journal of Mathematics. Please
            use the link below to verify your email address and activate your account.
          </Text>
          <Text>
            <Link href={verifyUrl}>Verify my email address</Link>
          </Text>
          <Text>This link expires in 24 hours and can only be used once.</Text>
          <Text>If you did not create this account, you can ignore this email.</Text>
        </Container>
      </Body>
    </Html>
  );
}

export default JournalVerifyEmail;
