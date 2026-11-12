"use client";

import { useState } from "react";
import type { SettingValue } from "@/server/services/site-settings";
import { saveDonationsAction } from "@/server/actions/site-settings";
import { useSectionSave } from "../use-section-save";
import { VersionHistoryDialog } from "../version-history-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Trash2 } from "lucide-react";

const textareaClass =
  "min-h-24 w-full border border-input bg-transparent p-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function DonationsSection({ value }: { value: SettingValue<"donations.details"> }) {
  const [enabled, setEnabled] = useState(value.enabled);
  const [heading, setHeading] = useState(value.heading);
  const [intro, setIntro] = useState(value.intro);
  const [purposes, setPurposes] = useState(
    value.purposes.length ? value.purposes : [{ title: "", description: "" }],
  );
  const [accountName, setAccountName] = useState(value.accountName);
  const [bankName, setBankName] = useState(value.bankName);
  const [accountNumber, setAccountNumber] = useState(value.accountNumber);
  const [swiftCode, setSwiftCode] = useState(value.swiftCode);
  const [reference, setReference] = useState(value.reference);
  const [receiptsNote, setReceiptsNote] = useState(value.receiptsNote);
  const [contactEmail, setContactEmail] = useState(value.contactEmail);
  const { result, pending, save, setDirty } = useSectionSave(saveDonationsAction);

  const change = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setDirty(true);
  };

  return (
    <section className="space-y-4 border-b border-border pb-8">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl font-semibold">Donations page</h2>
        <VersionHistoryDialog settingsKey="donations.details" />
      </div>

      <Alert>
        <AlertDescription>
          This page tells the public where to send money. Enter the department&apos;s own account details exactly as
          the bursary or finance office gave them, and check them again after every save. Every change is recorded
          in the activity log and version history, and the public page shows when the details were last changed.
        </AlertDescription>
      </Alert>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          className="size-5 accent-primary"
          checked={enabled}
          onChange={(e) => change(setEnabled)(e.target.checked)}
        />
        Show the donations page at /donate
      </label>

      <div className="space-y-1.5">
        <Label htmlFor="donations-heading">Heading</Label>
        <Input id="donations-heading" value={heading} maxLength={120} onChange={(e) => change(setHeading)(e.target.value)} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="donations-intro">Introduction (plain text; a blank line starts a new paragraph)</Label>
        <textarea
          id="donations-intro"
          className={textareaClass}
          maxLength={3000}
          value={intro}
          onChange={(e) => change(setIntro)(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>What gifts support (up to 8)</Label>
        {purposes.map((purpose, i) => (
          <div key={i} className="grid gap-2 border border-border p-3 sm:grid-cols-[1fr_2fr_auto]">
            <Input
              aria-label={`Purpose ${i + 1} title`}
              placeholder="Title"
              value={purpose.title}
              maxLength={120}
              onChange={(e) => {
                setPurposes((prev) => prev.map((p, idx) => (idx === i ? { ...p, title: e.target.value } : p)));
                setDirty(true);
              }}
            />
            <Input
              aria-label={`Purpose ${i + 1} description`}
              placeholder="Short description"
              value={purpose.description}
              maxLength={400}
              onChange={(e) => {
                setPurposes((prev) => prev.map((p, idx) => (idx === i ? { ...p, description: e.target.value } : p)));
                setDirty(true);
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove purpose ${i + 1}`}
              onClick={() => {
                setPurposes((prev) => prev.filter((_, idx) => idx !== i));
                setDirty(true);
              }}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        {purposes.length < 8 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPurposes((prev) => [...prev, { title: "", description: "" }])}
          >
            <Plus className="size-4" /> Add purpose
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="donations-account-name">Account name</Label>
          <Input id="donations-account-name" value={accountName} maxLength={120} onChange={(e) => change(setAccountName)(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="donations-bank">Bank</Label>
          <Input id="donations-bank" value={bankName} maxLength={120} onChange={(e) => change(setBankName)(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="donations-account-number">Account number</Label>
          <Input id="donations-account-number" inputMode="numeric" value={accountNumber} maxLength={34} onChange={(e) => change(setAccountNumber)(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="donations-swift">SWIFT code (for gifts from abroad, optional)</Label>
          <Input id="donations-swift" value={swiftCode} maxLength={11} onChange={(e) => change(setSwiftCode)(e.target.value)} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="donations-reference">Payment reference to ask donors to use (optional)</Label>
        <Input id="donations-reference" value={reference} maxLength={200} onChange={(e) => change(setReference)(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="donations-receipts">Note about receipts and thanks (optional)</Label>
        <Input id="donations-receipts" value={receiptsNote} maxLength={400} onChange={(e) => change(setReceiptsNote)(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="donations-email">Contact email for questions about giving (optional)</Label>
        <Input id="donations-email" type="email" value={contactEmail} maxLength={254} onChange={(e) => change(setContactEmail)(e.target.value)} />
      </div>

      {result?.error ? <Alert variant="destructive"><AlertDescription>{result.error}</AlertDescription></Alert> : null}
      {result?.success ? <Alert><AlertDescription>Saved.</AlertDescription></Alert> : null}
      <Button
        onClick={() => {
          const fd = new FormData();
          fd.set("enabled", String(enabled));
          fd.set("heading", heading);
          fd.set("intro", intro);
          purposes.forEach((purpose) => {
            fd.append("purposeTitle", purpose.title);
            fd.append("purposeDescription", purpose.description);
          });
          fd.set("accountName", accountName);
          fd.set("bankName", bankName);
          fd.set("accountNumber", accountNumber);
          fd.set("swiftCode", swiftCode);
          fd.set("reference", reference);
          fd.set("receiptsNote", receiptsNote);
          fd.set("contactEmail", contactEmail);
          save(fd);
        }}
        disabled={pending}
      >
        {pending ? "Saving..." : "Save"}
      </Button>
    </section>
  );
}
