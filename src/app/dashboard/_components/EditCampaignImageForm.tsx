"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FiImage, FiUploadCloud } from "react-icons/fi";
import { api } from "@/lib/api-client";
import { resolveCampaignImage } from "@/lib/campaign-image";
import type { Campaign } from "@/types/voucher";
import { FormCard } from "./FormPage";
import { normalizeCampaignImage } from "./NewCampaignForm";
import { appendDone } from "./SlotForm";

const LIST_HREF = "/dashboard/campaigns";

/**
 * Replace a campaign's artwork.
 *
 * Lives on its own route rather than in a dialog. The form's centrepiece is a
 * 2:1 preview of the image being replaced, and a modal capped that at the
 * dialog's height — the preview and the upload control could not both be on
 * screen at once, so you picked a file without seeing what you were replacing.
 * On a route the browser owns the scrolling, and the URL is linkable.
 */
export function EditCampaignImageForm({ campaign }: { campaign: Campaign }) {
  const router = useRouter();
  const currentImage = resolveCampaignImage(campaign);

  const [image, setImage] = useState(currentImage?.src ?? "");
  const [replacementSelected, setReplacementSelected] = useState(false);
  const [fileName, setFileName] = useState("");
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleImage(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    setError("");
    setProcessing(true);
    try {
      setImage(await normalizeCampaignImage(file));
      setReplacementSelected(true);
      setFileName(file.name);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to process the campaign image.",
      );
    } finally {
      setProcessing(false);
      input.value = "";
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!image || !replacementSelected) {
      setError("Choose a new image before saving.");
      return;
    }

    setSaving(true);
    try {
      await api<Campaign>(`/api/campaigns/${campaign.id}`, {
        method: "PATCH",
        body: JSON.stringify({ heroImage: image }),
      });
      router.push(appendDone(LIST_HREF, "campaign-image-saved"));
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to update the campaign image.",
      );
      setSaving(false);
    }
  }

  return (
    <form className="form-page-form" onSubmit={handleSubmit}>
      {error ? <p className="alert form-page-alert">{error}</p> : null}

      <FormCard
        title="Campaign artwork"
        description="Shown on the campaign page and on the customer's voucher. The image is center-cropped to 2:1 and optimized before it is saved."
      >
        <div className="field campaign-image-field">
          <span>{replacementSelected ? "New image" : "Current image"}</span>
          <div className="campaign-image-preview">
            {image ? (
              <Image
                alt={`${campaign.title} campaign image preview`}
                fill
                sizes="(max-width: 760px) calc(100vw - 80px), 640px"
                src={image}
                unoptimized
              />
            ) : (
              <div
                aria-label={`${campaign.title} current campaign artwork`}
                className="campaign-image-legacy-preview"
                role="img"
                style={{ background: "var(--canvas)" }}
              >
                <FiImage aria-hidden="true" />
              </div>
            )}
          </div>

          <label className="campaign-image-upload">
            <input
              accept="image/png,image/jpeg,image/webp"
              className="visually-hidden"
              disabled={processing || saving}
              onChange={handleImage}
              type="file"
            />
            <FiUploadCloud aria-hidden="true" />
            <span>
              <strong>
                {processing ? "Processing image..." : "Choose replacement image"}
              </strong>
              <small>{fileName || "PNG, JPEG, or WebP - up to 5 MB"}</small>
            </span>
          </label>
        </div>
      </FormCard>

      <div className="form-page-actions">
        <Link className="button secondary" href={LIST_HREF}>
          Cancel
        </Link>
        <button
          className="button"
          disabled={processing || saving || !image || !replacementSelected}
          type="submit"
        >
          {saving ? "Saving..." : "Save Image"}
        </button>
      </div>
    </form>
  );
}
