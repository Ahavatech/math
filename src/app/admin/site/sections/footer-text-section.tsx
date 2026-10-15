"use client";

import { useState } from "react";
import type { SettingValue } from "@/server/services/site-settings";
import { saveFooterTextAction } from "@/server/actions/site-settings";
import { useSectionSave } from "../use-section-save";
import { VersionHistoryDialog } from "../version-history-dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function FooterTextSection({ value }: { value: SettingValue<"footer.text"> }) {
  const [text, setText] = useState(value.text);
  const { result, pending, save, setDirty } = useSectionSave(saveFooterTextAction);

  return (
    <section className="space-y-3 pb-8">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl font-semibold">Footer text</h2>
        <VersionHistoryDialog settingsKey="footer.text" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="footer-text">Text</Label>
        <textarea
          id="footer-text"
          className="min-h-24 w-full rounded-lg border border-input bg-transparent p-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          value={text}
          onChange={(e) => { setText(e.target.value); setDirty(true); }}
        />
      </div>
      {result?.error ? <Alert variant="destructive"><AlertDescription>{result.error}</AlertDescription></Alert> : null}
      {result?.success ? <Alert><AlertDescription>Saved.</AlertDescription></Alert> : null}
      <Button
        onClick={() => {
          const fd = new FormData();
          fd.set("text", text);
          save(fd);
        }}
        disabled={pending}
      >
        {pending ? "Saving..." : "Save"}
      </Button>
    </section>
  );
}
