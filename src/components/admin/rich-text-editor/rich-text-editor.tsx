"use client";

import { useEditor, EditorContent } from "@tiptap/react";
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
}: {
  initialHtml: string;
  onChange: (html: string) => void;
  existingMedia: MediaAsset[];
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
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  if (!editor) return null;

  return (
    <div className="rounded-md border border-border">
      <div className="flex flex-wrap gap-1 border-b border-border p-2">
        <Button type="button" size="sm" variant="outline" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          H2
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
          H3
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => editor.chain().focus().toggleBold().run()}>
          Bold
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => editor.chain().focus().toggleItalic().run()}>
          Italic
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => editor.chain().focus().toggleBulletList().run()}>
          Bullet list
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          Numbered list
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          Quote
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            const url = window.prompt("Link URL");
            if (url) editor.chain().focus().setLink({ href: url }).run();
          }}
        >
          Link
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setShowImagePicker(true)}>
          Image
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setShowMathInput("inline")}>
          Math (inline)
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setShowMathInput("display")}>
          Math (display)
        </Button>
      </div>

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
