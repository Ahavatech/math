"use client";

import { useEditor, useEditorState, EditorContent, type Editor } from "@tiptap/react";
import {
  Bold,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Sigma,
  SquareSigma,
} from "lucide-react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import TiptapImage from "@tiptap/extension-image";
import type { MediaAsset } from "@prisma/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MathExtension } from "./math-extension";
import { MediaPicker } from "@/components/admin/media-picker";

export function RichTextEditor({
  initialHtml,
  onChange,
  existingMedia,
  label = "Content",
}: {
  initialHtml: string;
  onChange: (html: string) => void;
  existingMedia: MediaAsset[];
  /** Accessible name announced for the editing area; name it after the field. */
  label?: string;
}) {
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [showMathInput, setShowMathInput] = useState<"inline" | "display" | null>(null);
  const [mathDraft, setMathDraft] = useState("");

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Link.configure({ openOnClick: false }),
      TiptapImage,
      MathExtension,
    ],
    content: initialHtml,
    editorProps: {
      attributes: { "aria-label": label, "aria-multiline": "true" },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  if (!editor) return null;

  return (
    <div className="border border-border">
      <Toolbar
        editor={editor}
        onImage={() => setShowImagePicker(true)}
        onMath={(mode) => setShowMathInput(mode)}
      />

      <EditorContent editor={editor} className="prose-sm min-h-40 p-3 focus:outline-none" />

      {showMathInput ? (
        <div className="flex items-center gap-2 border-t border-border p-2">
          <input
            className="flex-1 rounded border border-input bg-background px-2 py-1 text-sm"
            placeholder="LaTeX, e.g. x^2 + y^2 = z^2"
            value={mathDraft}
            onChange={(e) => setMathDraft(e.target.value)}
            autoFocus
          />
          <Button
            type="button"
            size="sm"
            onClick={() => {
              editor.chain().focus().insertMath({ latex: mathDraft, display: showMathInput === "display" }).run();
              setMathDraft("");
              setShowMathInput(null);
            }}
          >
            Insert
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setShowMathInput(null)}>
            Cancel
          </Button>
        </div>
      ) : null}

      {showImagePicker ? (
        <div className="border-t border-border p-2">
          <MediaPicker
            folder="site"
            existing={existingMedia}
            value={null}
            onChange={(media) => {
              if (media) {
                editor.chain().focus().setImage({ src: media.url, alt: media.alt }).run();
              }
              setShowImagePicker(false);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

type ToolButton = {
  label: string;
  hint?: string;
  icon: typeof Bold;
  active?: boolean;
  onClick: () => void;
};

function Toolbar({
  editor,
  onImage,
  onMath,
}: {
  editor: Editor;
  onImage: () => void;
  onMath: (mode: "inline" | "display") => void;
}) {
  // The toolbar must redraw as the cursor moves so the buttons show which
  // formatting is active where the cursor is.
  const active = useEditorState({
    editor,
    selector: ({ editor }) => ({
      h2: editor.isActive("heading", { level: 2 }),
      h3: editor.isActive("heading", { level: 3 }),
      bold: editor.isActive("bold"),
      italic: editor.isActive("italic"),
      bullet: editor.isActive("bulletList"),
      ordered: editor.isActive("orderedList"),
      quote: editor.isActive("blockquote"),
      link: editor.isActive("link"),
    }),
  });

  const groups: ToolButton[][] = [
    [
      { label: "Heading", hint: "section heading", icon: Heading2, active: active.h2, onClick: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
      { label: "Subheading", hint: "smaller heading", icon: Heading3, active: active.h3, onClick: () => editor.chain().focus().toggleHeading({ level: 3 }).run() },
    ],
    [
      { label: "Bold", hint: "Ctrl+B", icon: Bold, active: active.bold, onClick: () => editor.chain().focus().toggleBold().run() },
      { label: "Italic", hint: "Ctrl+I", icon: Italic, active: active.italic, onClick: () => editor.chain().focus().toggleItalic().run() },
    ],
    [
      { label: "Bulleted list", icon: List, active: active.bullet, onClick: () => editor.chain().focus().toggleBulletList().run() },
      { label: "Numbered list", icon: ListOrdered, active: active.ordered, onClick: () => editor.chain().focus().toggleOrderedList().run() },
      { label: "Quote", icon: Quote, active: active.quote, onClick: () => editor.chain().focus().toggleBlockquote().run() },
    ],
    [
      {
        label: "Link",
        icon: LinkIcon,
        active: active.link,
        onClick: () => {
          const url = window.prompt("Link address, for example https://example.com");
          if (url) editor.chain().focus().setLink({ href: url }).run();
        },
      },
      { label: "Image", icon: ImageIcon, onClick: onImage },
    ],
    [
      { label: "Maths in a line", hint: "inline formula", icon: Sigma, onClick: () => onMath("inline") },
      { label: "Maths on its own line", hint: "display formula", icon: SquareSigma, onClick: () => onMath("display") },
    ],
  ];

  return (
    <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-x-1 gap-y-1 border-b border-border bg-muted/40 p-2">
      {groups.map((group, index) => (
        <div key={index} className="flex items-center gap-1 border-border not-first:border-l not-first:pl-2 not-first:ml-1">
          {group.map(({ label, hint, icon: Icon, active: isActive, onClick }) => (
            <Button
              key={label}
              type="button"
              size="icon"
              variant={isActive ? "default" : "outline"}
              aria-label={label}
              aria-pressed={isActive === undefined ? undefined : isActive}
              title={hint ? `${label} (${hint})` : label}
              onClick={onClick}
            >
              <Icon aria-hidden="true" />
            </Button>
          ))}
        </div>
      ))}
    </div>
  );
}
