import { cn } from "cn";

export function Section({
  className,
  ...props
}: React.ComponentProps<"section">) {
  return <section className={cn("py-10 sm:py-14", className)} {...props} />;
}
