import { cn } from "cn";

/**
 * Typography wrapper for rendered rich text (page bodies, news/article
 * content), set like a journal page: a serif reading face at a comfortable
 * measure. Callers are responsible for sanitising HTML before it
 * reaches here. See CLAUDE.md's "Sanitise rich text before rendering."
 */
export function Prose({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "max-w-[68ch] font-serif text-[1.0625rem] leading-[1.75] text-foreground",
        "[&>*+*]:mt-5",
        "[&_h2]:font-heading [&_h2]:mt-12 [&_h2]:border-t [&_h2]:border-border [&_h2]:pt-5 [&_h2]:text-2xl [&_h2]:leading-tight [&_h2]:font-semibold",
        "[&_h3]:font-heading [&_h3]:mt-8 [&_h3]:text-xl [&_h3]:leading-tight [&_h3]:font-semibold",
        "[&_p]:leading-[1.75]",
        "[&_a]:link-rule [&_a]:font-medium [&_a]:text-primary [&_a]:no-underline",
        "[&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:pl-1 [&_li+li]:mt-1.5",
        "[&_blockquote]:border-l-2 [&_blockquote]:border-accent [&_blockquote]:pl-5 [&_blockquote]:text-muted-foreground [&_blockquote]:italic",
        "[&_code]:rounded-sm [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em]",
        "[&_table]:w-full [&_table]:border-collapse [&_table]:text-[0.95rem] [&_th]:border-b-2 [&_th]:border-foreground [&_th]:py-2 [&_th]:pr-4 [&_th]:text-left [&_th]:font-sans [&_th]:font-semibold [&_td]:border-b [&_td]:border-border [&_td]:py-2 [&_td]:pr-4",
        className,
      )}
      {...props}
    />
  );
}
