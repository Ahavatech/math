import { env } from "@/lib/env";
import { signFormTimestamp } from "@/lib/form-spam";
import { RegisterAuthorForm } from "./register-form";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";

export function generateMetadata() {
  return { title: "Register to Submit" };
}

export default function JournalRegisterPage() {
  const { formToken, formRenderedAt } = signFormTimestamp(env.AUTH_SECRET);

  return (
    <Section>
      <Container className="max-w-md">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Journal", href: "/journal" },
            { label: "Register" },
          ]}
        />
        <div className="mt-6 space-y-1">
          <h1 className="font-heading text-2xl font-semibold">Create a submission account</h1>
          <p className="text-muted-foreground text-sm">
            Register to submit articles to the OAU Journal of Mathematics. You will receive a
            verification email before you can submit.
          </p>
        </div>
        <RegisterAuthorForm formToken={formToken} formRenderedAt={formRenderedAt} />
      </Container>
    </Section>
  );
}
