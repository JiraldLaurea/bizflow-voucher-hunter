"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FiImage, FiUploadCloud, FiX } from "react-icons/fi";
import { api } from "@/lib/api-client";
import {
  isUploadedCampaignImage,
  MAX_CAMPAIGN_IMAGE_DATA_URL_LENGTH,
  MAX_CAMPAIGN_IMAGE_UPLOAD_BYTES,
} from "@/lib/campaign-image";
import type { Business, Campaign } from "@/types/voucher";
import { AdminModal } from "./AdminModal";

const emptyBusiness = { name: "", logoText: "", industry: "restaurant", staffPin: "" };
const emptyCampaign = {
  businessId: "",
  slug: "",
  title: "",
  mode: "restaurant",
  location: "",
  offerMessage: "",
  heroImage: "",
  startDate: "",
  endDate: "",
  baseAttempts: "3",
  referralDailyLimit: "5",
  candidateTimeoutMinutes: "10",
  terms: "Standard terms and conditions apply.",
  shopUrl: "",
  allowReschedule: false,
};

const supportedCampaignImageTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export async function normalizeCampaignImage(file: File) {
  if (!supportedCampaignImageTypes.has(file.type)) {
    throw new Error("Choose a PNG, JPEG, or WebP campaign image.");
  }
  if (file.size > MAX_CAMPAIGN_IMAGE_UPLOAD_BYTES) {
    throw new Error("Campaign images must be 5 MB or smaller.");
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const source = document.createElement("img");
    source.src = objectUrl;
    await source.decode();
    if (!source.naturalWidth || !source.naturalHeight) {
      throw new Error("The selected image could not be read.");
    }

    // Directory artwork is 2:1. Crop from the centre once during upload so the
    // public card never downloads an oversized original or shifts while sizing.
    const targetRatio = 2;
    let sourceX = 0;
    let sourceY = 0;
    let sourceWidth = source.naturalWidth;
    let sourceHeight = source.naturalHeight;
    if (sourceWidth / sourceHeight > targetRatio) {
      sourceWidth = sourceHeight * targetRatio;
      sourceX = (source.naturalWidth - sourceWidth) / 2;
    } else {
      sourceHeight = sourceWidth / targetRatio;
      sourceY = (source.naturalHeight - sourceHeight) / 2;
    }

    const outputWidth = Math.min(1200, Math.max(2, Math.round(sourceWidth)));
    const outputHeight = Math.max(1, Math.round(outputWidth / targetRatio));
    const canvas = document.createElement("canvas");
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image processing is unavailable.");
    context.fillStyle = "#f7f9fd";
    context.fillRect(0, 0, outputWidth, outputHeight);
    context.drawImage(
      source,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      outputWidth,
      outputHeight,
    );

    let dataUrl = "";
    for (const quality of [0.84, 0.7, 0.56]) {
      dataUrl = canvas.toDataURL("image/webp", quality);
      if (dataUrl.length <= MAX_CAMPAIGN_IMAGE_DATA_URL_LENGTH) break;
    }
    if (
      dataUrl.length > MAX_CAMPAIGN_IMAGE_DATA_URL_LENGTH ||
      !isUploadedCampaignImage(dataUrl)
    ) {
      throw new Error("The processed image is still too large. Choose a smaller image.");
    }
    return dataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function NewCampaignForm({ businesses }: { businesses: Business[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [creatingBusiness, setCreatingBusiness] = useState(businesses.length === 0);
  const [business, setBusiness] = useState(emptyBusiness);
  const [campaign, setCampaign] = useState({
    ...emptyCampaign,
    businessId: businesses[0]?.id ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [imageProcessing, setImageProcessing] = useState(false);
  const [campaignImageName, setCampaignImageName] = useState("");
  const [error, setError] = useState("");

  async function handleCampaignImage(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setError("");
    setImageProcessing(true);
    try {
      const heroImage = await normalizeCampaignImage(file);
      setCampaign((current) => ({ ...current, heroImage }));
      setCampaignImageName(file.name);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to process the campaign image.");
    } finally {
      setImageProcessing(false);
      input.value = "";
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (!campaign.heroImage) {
        throw new Error("Upload a campaign image before creating the campaign.");
      }
      let businessId = campaign.businessId;
      if (creatingBusiness) {
        const createdBusiness = await api<Business>("/api/businesses", {
          method: "POST",
          body: JSON.stringify(business),
        });
        businessId = createdBusiness.id;
      }
      if (!businessId) {
        throw new Error("Select or create a business first.");
      }
      const createdCampaign = await api<Campaign>("/api/campaigns", {
        method: "POST",
        body: JSON.stringify({
          businessId,
          slug: campaign.slug,
          title: campaign.title,
          mode: campaign.mode,
          location: campaign.location || undefined,
          offerMessage: campaign.offerMessage,
          heroImage: campaign.heroImage,
          startDate: campaign.startDate,
          endDate: campaign.endDate,
          baseAttempts: Number(campaign.baseAttempts),
          referralDailyLimit: Number(campaign.referralDailyLimit),
          candidateTimeoutMinutes: Number(campaign.candidateTimeoutMinutes),
          terms: campaign.terms,
          shopUrl: campaign.shopUrl || undefined,
          allowReschedule: campaign.allowReschedule,
          status: "active",
        }),
      });
      router.push(`/dashboard/campaigns?campaign=${createdCampaign.slug}`);
      router.refresh();
      setOpen(false);
      setBusiness(emptyBusiness);
      setCampaign({ ...emptyCampaign, businessId: businesses[0]?.id ?? "" });
      setCampaignImageName("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create campaign.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="button admin-form-toggle" onClick={() => setOpen(true)} type="button">
        New Campaign
      </button>

      {open ? (
        <AdminModal
          title="New Campaign"
          subtitle="Set up a business, schedule, and hunt rules."
          onClose={() => setOpen(false)}
        >
          <form className="modal-form" onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-section">
                  <span className="form-section-title">Business</span>
                  <div className="segmented" role="tablist">
                    <button
                      type="button"
                      className={!creatingBusiness ? "active" : ""}
                      disabled={businesses.length === 0}
                      onClick={() => setCreatingBusiness(false)}
                    >
                      Use existing
                    </button>
                    <button
                      type="button"
                      className={creatingBusiness ? "active" : ""}
                      onClick={() => setCreatingBusiness(true)}
                    >
                      Create new
                    </button>
                  </div>

                  {creatingBusiness ? (
                    <div className="admin-form-grid">
                      <label className="field">
                        <span>Business Name</span>
                        <input
                          required
                          value={business.name}
                          onChange={(event) => setBusiness({ ...business, name: event.target.value })}
                        />
                      </label>
                      <label className="field">
                        <span>Logo Text</span>
                        <input
                          maxLength={4}
                          required
                          value={business.logoText}
                          onChange={(event) => setBusiness({ ...business, logoText: event.target.value })}
                        />
                      </label>
                      <label className="field">
                        <span>Industry</span>
                        <select
                          value={business.industry}
                          onChange={(event) => setBusiness({ ...business, industry: event.target.value })}
                        >
                          <option value="restaurant">Restaurant</option>
                          <option value="online_shop">Online Shop</option>
                          <option value="beauty">Beauty</option>
                          <option value="pet">Pet</option>
                          <option value="retail">Retail</option>
                          <option value="other">Other</option>
                        </select>
                      </label>
                      <label className="field">
                        <span>Staff PIN (4-6 digits)</span>
                        <input
                          required
                          value={business.staffPin}
                          onChange={(event) => setBusiness({ ...business, staffPin: event.target.value })}
                        />
                      </label>
                    </div>
                  ) : (
                    <label className="field">
                      <span>Select a business</span>
                      <select
                        required
                        value={campaign.businessId}
                        onChange={(event) => setCampaign({ ...campaign, businessId: event.target.value })}
                      >
                        <option value="">Select a business</option>
                        {businesses.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>

                <div className="form-section">
                  <span className="form-section-title">Campaign details</span>
                  <div className="admin-form-grid">
                    <label className="field">
                      <span>Campaign Title</span>
                      <input
                        required
                        value={campaign.title}
                        onChange={(event) => setCampaign({ ...campaign, title: event.target.value })}
                      />
                    </label>
                    <label className="field">
                      <span>Slug (URL-friendly)</span>
                      <input
                        pattern="[a-z0-9-]+"
                        placeholder="july-dinner"
                        required
                        title="Lowercase letters, numbers, and hyphens only"
                        value={campaign.slug}
                        onChange={(event) => setCampaign({ ...campaign, slug: event.target.value })}
                      />
                    </label>
                    <label className="field">
                      <span>Mode</span>
                      <select
                        value={campaign.mode}
                        onChange={(event) => setCampaign({ ...campaign, mode: event.target.value })}
                      >
                        <option value="restaurant">Restaurant</option>
                        <option value="online_shop">Online Shop</option>
                        <option value="beauty">Beauty</option>
                        <option value="pet">Pet</option>
                        <option value="retail">Retail</option>
                        <option value="other">Other</option>
                      </select>
                    </label>
                    <label className="field">
                      <span>Location</span>
                      <input
                        placeholder="Makati City"
                        value={campaign.location}
                        onChange={(event) => setCampaign({ ...campaign, location: event.target.value })}
                      />
                    </label>
                  </div>
                </div>

                <div className="form-section">
                  <span className="form-section-title">Schedule &amp; hunt rules</span>
                  <div className="admin-form-grid">
                    <label className="field">
                      <span>Start Date</span>
                      <input
                        required
                        type="date"
                        value={campaign.startDate}
                        onChange={(event) => setCampaign({ ...campaign, startDate: event.target.value })}
                      />
                    </label>
                    <label className="field">
                      <span>End Date</span>
                      <input
                        required
                        type="date"
                        value={campaign.endDate}
                        onChange={(event) => setCampaign({ ...campaign, endDate: event.target.value })}
                      />
                    </label>
                    <label className="field">
                      <span>Base Attempts</span>
                      <input
                        min={1}
                        required
                        type="number"
                        value={campaign.baseAttempts}
                        onChange={(event) => setCampaign({ ...campaign, baseAttempts: event.target.value })}
                      />
                    </label>
                    <label className="field">
                      <span>Referral Daily Limit</span>
                      <input
                        min={0}
                        required
                        type="number"
                        value={campaign.referralDailyLimit}
                        onChange={(event) => setCampaign({ ...campaign, referralDailyLimit: event.target.value })}
                      />
                    </label>
                    <label className="field">
                      <span>Candidate Timeout (minutes)</span>
                      <input
                        min={1}
                        required
                        type="number"
                        value={campaign.candidateTimeoutMinutes}
                        onChange={(event) =>
                          setCampaign({ ...campaign, candidateTimeoutMinutes: event.target.value })
                        }
                      />
                    </label>
                    {campaign.mode === "online_shop" ? (
                      <label className="field">
                        <span>Shop URL</span>
                        <input
                          placeholder="https://example.com/shop"
                          type="url"
                          value={campaign.shopUrl}
                          onChange={(event) => setCampaign({ ...campaign, shopUrl: event.target.value })}
                        />
                      </label>
                    ) : null}
                  </div>
                </div>

                <div className="form-section">
                  <span className="form-section-title">Content</span>
                  <div className="field campaign-image-field">
                    <span>Campaign Image</span>
                    {campaign.heroImage ? (
                      <div className="campaign-image-preview">
                        <Image
                          alt="Campaign image preview"
                          fill
                          sizes="(max-width: 760px) calc(100vw - 80px), 560px"
                          src={campaign.heroImage}
                          unoptimized
                        />
                        <button
                          aria-label="Remove campaign image"
                          className="campaign-image-remove"
                          onClick={() => {
                            setCampaign((current) => ({ ...current, heroImage: "" }));
                            setCampaignImageName("");
                          }}
                          type="button"
                        >
                          <FiX aria-hidden="true" />
                        </button>
                      </div>
                    ) : null}
                    <label className="campaign-image-upload">
                      <input
                        accept="image/png,image/jpeg,image/webp"
                        className="visually-hidden"
                        disabled={busy || imageProcessing}
                        onChange={handleCampaignImage}
                        type="file"
                      />
                      {campaign.heroImage ? (
                        <FiImage aria-hidden="true" />
                      ) : (
                        <FiUploadCloud aria-hidden="true" />
                      )}
                      <span>
                        <strong>
                          {imageProcessing
                            ? "Processing image..."
                            : campaign.heroImage
                              ? "Replace image"
                              : "Upload campaign image"}
                        </strong>
                        <small>
                          {campaignImageName || "PNG, JPEG, or WebP · up to 5 MB"}
                        </small>
                      </span>
                    </label>
                    <small className="campaign-image-help">
                      Images are cropped to a 2:1 ratio and optimized before upload.
                    </small>
                  </div>
                  <label className="field">
                    <span>Offer Message</span>
                    <input
                      required
                      value={campaign.offerMessage}
                      onChange={(event) => setCampaign({ ...campaign, offerMessage: event.target.value })}
                    />
                  </label>
                  <label className="field">
                    <span>Terms</span>
                    <input
                      required
                      value={campaign.terms}
                      onChange={(event) => setCampaign({ ...campaign, terms: event.target.value })}
                    />
                  </label>
                </div>

                <div className="form-section">
                  <span className="form-section-title">Options</span>
                  <div className="admin-form-toggles">
                    <label className="admin-form-toggle-row">
                      <input
                        checked={campaign.allowReschedule}
                        onChange={(event) => setCampaign({ ...campaign, allowReschedule: event.target.checked })}
                        type="checkbox"
                      />
                      Allow rescheduling issued reservations
                    </label>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                {error ? <p className="alert">{error}</p> : null}
                <button className="button secondary" onClick={() => setOpen(false)} type="button">
                  Cancel
                </button>
                <button className="button" disabled={busy || imageProcessing} type="submit">
                  {busy ? "Creating..." : "Create Campaign"}
                </button>
              </div>
            </form>
        </AdminModal>
      ) : null}
    </>
  );
}
