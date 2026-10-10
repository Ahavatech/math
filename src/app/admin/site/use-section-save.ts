"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type ActionResult = { error?: string; success?: boolean };

export function useSectionSave(action: (prev: ActionResult | undefined, fd: FormData) => Promise<ActionResult>) {
  const router = useRouter();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();

  function save(formData: FormData) {
    setResult(null);
    startTransition(async () => {
      const res = await action(undefined, formData);
      setResult(res);
      if (!res.error) {
        setDirty(false);
        router.refresh();
      }
    });
  }

  return { result, pending, save, dirty, setDirty };
}
