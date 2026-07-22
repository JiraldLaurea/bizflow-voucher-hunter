"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FiEdit2, FiImage, FiUploadCloud } from "react-icons/fi";
import { api } from "@/lib/api-client";
import {
  resolveCampaignImage,
} from "@/lib/campaign-image";
import type { Campaign } from "@/types/voucher";
import { AdminModal } from "./AdminModal";
import { normalizeCampaignImage } from "./NewCampaignForm";

export function EditCampaignImageForm({ campaign }: { campaign: Campaign }) {
  const router = useRouter();
  const currentImage = resolveCampaignImage(campaign);
  const [open, setOpen] = useState(false);
  const [image, setImage] = useState(currentImage?.src ?? "");
  const [replacementSelected, setReplacementSelected] = useState(false);
  const [fileName, setFileName] = useState("");
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function close() {
    if (processing || saving) return;
    setOpen(false);
    setImage(currentImage?.src ?? "");
    setReplacementSelected(false);
    setFileName("");
    setError("");
  }

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
      setError(caught instanceof Error ? caught.message : "Unable to process the campaign image.");
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
      setOpen(false);
      setFileName("");
      setReplacementSelected(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update the campaign image.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        className="campaign-edit-image-button"
        onClick={() => {
          setImage(currentImage?.src ?? "");
          setReplacementSelected(false);
          setOpen(true);
        }}
        type="button"
      >
        <FiEdit2 aria-hidden="true" />
        Edit image
      </button>

      {open ? (
        <AdminModal
          onClose={close}
          subtitle={`Replace the artwork shown for ${campaign.title}.`}
          title="Edit Campaign Image"
        >
          <form className="modal-form" onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="form-section">
                <span className="form-section-title">Campaign artwork</span>
                <div className="field campaign-image-field">
                  <span>Image preview</span>
                  <div className="campaign-image-preview">
                    {image ? (
                      <Image
                        alt={`${campaign.title} campaign image preview`}
                        fill
                        sizes="(max-width: 760px) calc(100vw - 80px), 560px"
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
                      <strong>{processing ? "Processing image..." : "Choose replacement image"}</strong>
                      <small>{fileName || "PNG, JPEG, or WebP - up to 5 MB"}</small>
                    </span>
                  </label>
                  <small className="campaign-image-help">
                    The image is center-cropped to 2:1 and optimized before it is saved.
                  </small>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              {error ? <p className="alert">{error}</p> : null}
              <button className="button secondary" disabled={processing || saving} onClick={close} type="button">
                Cancel
              </button>
              <button
                className="button"
                disabled={processing || saving || !image || !replacementSelected}
                type="submit"
              >
                {saving ? "Saving..." : "Save Image"}
              </button>
            </div>
          </form>
        </AdminModal>
      ) : null}
    </>
  );
}
