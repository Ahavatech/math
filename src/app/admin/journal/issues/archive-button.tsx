"use client";

import { ConfirmButton } from "@/components/admin/confirm-button";

export function ArchiveButton({
  id,
  action,
  subject,
}: {
  id: string;
  action: (id: string) => Promise<void>;
  subject?: string;
}) {
  return (
    <ConfirmButton
      label="Archive"
      subject={subject}
      variant="outline"
      title="Archive this issue?"
      description="The issue is taken off the public journal pages. You can restore it from the issue's page."
      confirmLabel="Archive issue"
      onConfirm={() => action(id)}
    />
  );
}
