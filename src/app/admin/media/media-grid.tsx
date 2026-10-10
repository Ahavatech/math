"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { MediaAsset } from "@prisma/client";
import { CloudImage } from "@/components/ui/cloud-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { MediaPicker } from "@/components/admin/media-picker";
import { updateMediaAltAction, deleteMediaAction } from "@/server/actions/media";
import { ImageIcon } from "lucide-react";

type AssetWithUsage = MediaAsset & { usageCount: number };

function MediaCard({ asset }: { asset: AssetWithUsage }) {
  const router = useRouter();
  const [alt, setAlt] = useState(asset.alt ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSaveAlt() {
    setSaving(true);
    setError(null);
    const formData = new FormData();
    formData.set("mediaId", asset.id);
    formData.set("alt", alt);
    const result = await updateMediaAltAction(formData);
    setSaving(false);
    if (result.error) setError(result.error);
    else router.refresh();
  }

  async function handleDelete() {
    setError(null);
    const formData = new FormData();
    formData.set("mediaId", asset.id);
    const result = await deleteMediaAction(formData);
    if (result.error) setError(result.error);
    else router.refresh();
  }

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <CloudImage
        src={asset.url}
        alt={asset.alt ?? ""}
        width={240}
        height={160}
        className="h-32 w-full rounded-md object-cover"
      />
      <Input value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="Alt text" />
      <div className="flex items-center justify-between gap-2">
        <Badge variant={asset.usageCount > 0 ? "secondary" : "outline"}>
          {asset.usageCount > 0 ? `Used ${asset.usageCount}x` : "Unused"}
        </Badge>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={handleSaveAlt} disabled={saving}>
            Save
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={handleDelete}
            disabled={asset.usageCount > 0}
            title={asset.usageCount > 0 ? "Still in use elsewhere" : "Delete"}
          >
            Delete
          </Button>
        </div>
      </div>
      {error ? (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function MediaGrid({ assets }: { assets: AssetWithUsage[] }) {
  const router = useRouter();

  return (
    <div className="space-y-4">
      <MediaPicker
        folder="site"
        existing={[]}
        value={null}
        onChange={() => router.refresh()}
        label="Add to library"
      />

      {assets.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title="No media yet"
          description="Upload an image above to add it to the library."
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {assets.map((asset) => (
            <MediaCard key={asset.id} asset={asset} />
          ))}
        </div>
      )}
    </div>
  );
}
