import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import katex from "katex";
import { useState } from "react";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    math: {
      insertMath: (options: { latex: string; display: boolean }) => ReturnType;
    };
  }
}

function MathNodeView({
  node,
  updateAttributes,
}: {
  // Tiptap's ReactNodeViewProps types `node.attrs` generically; this
  // node view only ever runs on `math` nodes, whose attrs are always
  // { latex, display } per addAttributes() below.
  node: { attrs: { latex: string; display: boolean } };
  updateAttributes: (attrs: Record<string, unknown>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(node.attrs.latex);

  let preview = "";
  try {
    preview = katex.renderToString(draft || " ", {
      displayMode: node.attrs.display,
      throwOnError: false,
      trust: false,
    });
  } catch {
    preview = "(invalid LaTeX)";
  }

  if (editing) {
    return (
      <NodeViewWrapper as="span" className="inline-flex flex-col gap-1 rounded border border-border bg-muted p-2">
        <input
          className="rounded border border-input bg-background px-1 text-sm"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoFocus
        />
        <span dangerouslySetInnerHTML={{ __html: preview }} />
        <button
          type="button"
          className="text-xs underline"
          onClick={() => {
            updateAttributes({ latex: draft });
            setEditing(false);
          }}
        >
          Done
        </button>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper
      as="span"
      className="cursor-pointer rounded border border-dashed border-border px-1"
      onClick={() => setEditing(true)}
      data-latex={node.attrs.latex}
      data-display={node.attrs.display}
    >
      <span dangerouslySetInnerHTML={{ __html: preview }} />
    </NodeViewWrapper>
  );
}

export const MathExtension = Node.create({
  name: "math",
  group: "inline",
  inline: true,
  atom: true,

  addAttributes() {
    return {
      latex: { default: "" },
      display: { default: false },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-latex]" }];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-latex": node.attrs.latex,
        "data-display": String(node.attrs.display),
      }),
      node.attrs.latex,
    ];
  },

  addNodeView() {
    // Cast: MathNodeView's props are a narrowed, correct subset of
    // Tiptap's generic ReactNodeViewProps for this specific node type
    // (see the comment on MathNodeView's props above).
    return ReactNodeViewRenderer(
      MathNodeView as unknown as Parameters<typeof ReactNodeViewRenderer>[0],
    );
  },

  addCommands() {
    return {
      insertMath:
        (options) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: options }),
    };
  },
});
