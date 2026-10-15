"use client";

import { useState } from "react";
import type { SettingValue } from "@/server/services/site-settings";
import { saveContactAction } from "@/server/actions/site-settings";
import { useSectionSave } from "../use-section-save";
import { VersionHistoryDialog } from "../version-history-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Trash2 } from "lucide-react";

export function ContactSection({ value }: { value: SettingValue<"contact.details"> }) {
  const [address, setAddress] = useState(value.address);
  const [phones, setPhones] = useState<string[]>(value.phones.length ? value.phones : [""]);
  const [email, setEmail] = useState(value.email);
  const [officeHours, setOfficeHours] = useState(value.officeHours);
  const [mapLat, setMapLat] = useState(value.mapLat === null ? "" : String(value.mapLat));
  const [mapLng, setMapLng] = useState(value.mapLng === null ? "" : String(value.mapLng));
  const { result, pending, save, setDirty } = useSectionSave(saveContactAction);

  return (
    <section className="space-y-3 border-b border-border pb-8">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl font-semibold">Contact</h2>
        <VersionHistoryDialog settingsKey="contact.details" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="contact-address">Address</Label>
        <Input id="contact-address" value={address} onChange={(e) => { setAddress(e.target.value); setDirty(true); }} />
      </div>
      <div className="space-y-1.5">
        <Label>Phone numbers</Label>
        {phones.map((phone, i) => (
          <div key={i} className="flex gap-2">
            <Input
              value={phone}
              onChange={(e) => {
                setPhones((prev) => prev.map((p, idx) => (idx === i ? e.target.value : p)));
                setDirty(true);
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => {
                setPhones((prev) => prev.filter((_, idx) => idx !== i));
                setDirty(true);
              }}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setPhones((prev) => [...prev, ""])}
        >
          <Plus className="size-4" /> Add phone
        </Button>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="contact-email">Email</Label>
        <Input id="contact-email" value={email} onChange={(e) => { setEmail(e.target.value); setDirty(true); }} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="contact-office-hours">Office hours</Label>
        <Input id="contact-office-hours" value={officeHours} onChange={(e) => { setOfficeHours(e.target.value); setDirty(true); }} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="contact-lat">Map latitude</Label>
          <Input id="contact-lat" value={mapLat} onChange={(e) => { setMapLat(e.target.value); setDirty(true); }} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contact-lng">Map longitude</Label>
          <Input id="contact-lng" value={mapLng} onChange={(e) => { setMapLng(e.target.value); setDirty(true); }} />
        </div>
      </div>
      {result?.error ? <Alert variant="destructive"><AlertDescription>{result.error}</AlertDescription></Alert> : null}
      {result?.success ? <Alert><AlertDescription>Saved.</AlertDescription></Alert> : null}
      <Button
        onClick={() => {
          const fd = new FormData();
          fd.set("address", address);
          phones.filter(Boolean).forEach((phone) => fd.append("phones", phone));
          fd.set("email", email);
          fd.set("officeHours", officeHours);
          fd.set("mapLat", mapLat);
          fd.set("mapLng", mapLng);
          save(fd);
        }}
        disabled={pending}
      >
        {pending ? "Saving..." : "Save"}
      </Button>
    </section>
  );
}
