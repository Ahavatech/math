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

export function AlumniApprovedEmail({
  name,
  directoryUrl,
  contactUrl,
}: {
  name: string;
  directoryUrl: string;
  contactUrl: string;
}) {
  return (
    <Html>
      <Head />
      <Preview>Your entry is now on the department website</Preview>
      <Body style={{ fontFamily: "sans-serif", backgroundColor: "#ffffff" }}>
        <Container>
          <Heading>Thank you, {name}</Heading>
          <Text>
            The department has checked your alumni entry and it is now visible on the public
            alumni page.
          </Text>
          <Text>
            <Link href={directoryUrl}>View the alumni directory</Link>
          </Text>
          <Text>
            If anything needs correcting, or you would like your entry removed, contact the
            department using the link below.
          </Text>
          <Text>
            <Link href={contactUrl}>Request a correction or removal</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default AlumniApprovedEmail;
