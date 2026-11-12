import { cn } from "cn";

export function Section({
  className,
  ...props
}: React.ComponentProps<"section">) {
  return <section className={cn("py-12 sm:py-16", className)} {...props} />;
}
