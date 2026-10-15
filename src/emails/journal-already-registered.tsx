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

export function JournalAlreadyRegisteredEmail({ signInUrl }: { signInUrl: string }) {
  return (
    <Html>
      <Head />
      <Preview>You already have an account for journal submissions</Preview>
      <Body style={{ fontFamily: "sans-serif", backgroundColor: "#ffffff" }}>
        <Container>
          <Heading>You already have an account</Heading>
          <Text>
            We received a registration request for this email address, but an account
            already exists. You can sign in directly.
          </Text>
          <Text>
            <Link href={signInUrl}>Sign in to your account</Link>
          </Text>
          <Text>If you forgot your password, use the sign-in page to reset it.</Text>
          <Text>If you did not make this request, you can ignore this email.</Text>
        </Container>
      </Body>
    </Html>
  );
}

export default JournalAlreadyRegisteredEmail;
