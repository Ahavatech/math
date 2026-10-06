import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";

export default function Home() {
  return (
    <Section>
      <Container>
        <h1 className="font-heading text-4xl font-semibold">
          Department of Mathematics
        </h1>
        <p className="mt-2 text-muted-foreground">
          Obafemi Awolowo University, Ile-Ife
        </p>
      </Container>
    </Section>
  );
}
