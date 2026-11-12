import { cn } from "cn";

export function Container({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("mx-auto w-full max-w-6xl px-(--gutter)", className)}
      {...props}
    />
  );
}
