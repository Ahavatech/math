"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { prepareArticleAction } from "@/server/actions/journal-articles";

export function PrepareForPublicationForm({ manuscriptId }: { manuscriptId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await prepareArticleAction(manuscriptId);
      if (result.error) { setError(result.error); return; }
      router.push(`/admin/journal/articles/${result.id}`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <p className="text-sm">This manuscript has been accepted. Start the publication workflow to create an article record.</p>
      {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
      >
        {pending ? "Preparing..." : "Prepare for publication"}
      </button>
    </form>
  );
}
