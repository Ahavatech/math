import { cn } from "cn";

/**
 * Typography wrapper for rendered rich text (page bodies, news/article
 * content). Callers are responsible for sanitising HTML before it
 * reaches here — see CLAUDE.md's "Sanitise rich text before rendering."
 */
export function Prose({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "max-w-[70ch] text-base leading-relaxed text-foreground",
        "[&>*+*]:mt-4",
        "[&_h2]:font-heading [&_h2]:mt-10 [&_h2]:text-2xl [&_h2]:font-semibold",
        "[&_h3]:font-heading [&_h3]:mt-8 [&_h3]:text-xl [&_h3]:font-semibold",
        "[&_p]:text-base [&_p]:leading-relaxed",
        "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2",
        "[&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6",
        "[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground",
        "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-sm",
        className,
      )}
      {...props}
    />
  );
}
