"use client";

import type { JournalSettings } from "@/lib/validators/journal";
import { saveJournalSettingsAction } from "@/server/actions/site-settings";
import { useSectionSave } from "@/app/admin/site/use-section-save";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function SettingsForm({ settings, licenses }: { settings: JournalSettings; licenses: readonly string[] }) {
  const { result, pending, save } = useSectionSave(saveJournalSettingsAction);

  return (
    <form action={save} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Journal name" name="name" defaultValue={settings.name} />
        <Field label="Short name" name="shortName" defaultValue={settings.shortName} />
        <Field label="ISSN" name="issn" defaultValue={settings.issn} placeholder="NNNN-NNNN" />
        <Field label="e-ISSN" name="eissn" defaultValue={settings.eissn} placeholder="NNNN-NNNN" />
        <Field label="Publisher" name="publisher" defaultValue={settings.publisher} />
        <Field label="Frequency" name="frequency" defaultValue={settings.frequency} placeholder="e.g. Biannual" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="license">Article licence</Label>
        <select id="license" name="license" defaultValue={settings.license} className="border-input w-full rounded-md border bg-transparent px-3 py-2 text-sm">
          {licenses.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Licence URL (https only)" name="licenseUrl" defaultValue={settings.licenseUrl} />
        <Field label="Custom licence text" name="customLicenseText" defaultValue={settings.customLicenseText} />
        <Field label="Journal contact email" name="contactEmail" defaultValue={settings.contactEmail} />
        <Field label="Default &quot;Cite as&quot; publisher string" name="citeAsPublisher" defaultValue={settings.citeAsPublisher} />
      </div>

      <div className="flex items-center gap-2">
        <input type="checkbox" id="submissionsOpen" name="submissionsOpen" defaultChecked={settings.submissionsOpen} className="size-4" />
        <Label htmlFor="submissionsOpen">Submissions open (used by Stage 12)</Label>
      </div>

      {result?.error ? <Alert variant="destructive"><AlertDescription>{result.error}</AlertDescription></Alert> : null}
      {result?.success ? <Alert><AlertDescription>Saved.</AlertDescription></Alert> : null}
      <Button type="submit" disabled={pending}>{pending ? "Saving..." : "Save"}</Button>
    </form>
  );
}

function Field({ label, name, defaultValue, placeholder }: { label: string; name: string; defaultValue: string; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} defaultValue={defaultValue} placeholder={placeholder} />
    </div>
  );
}
