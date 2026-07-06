"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import type { Business, Campaign } from "@/types/voucher";

const emptyBusiness = { name: "", logoText: "", industry: "restaurant", staffPin: "" };
const emptyCampaign = {
  businessId: "",
  slug: "",
  title: "",
  mode: "restaurant",
  offerMessage: "",
  heroImage: "linear-gradient(135deg, rgba(92,61,255,.9), rgba(124,77,255,.76))",
  startDate: "",
  endDate: "",
  baseAttempts: "3",
  referralDailyLimit: "5",
  candidateTimeoutMinutes: "10",
  terms: "Standard terms and conditions apply.",
  shopUrl: "",
  requireOtp: false,
  allowReschedule: false,
};

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
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
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
          offerMessage: campaign.offerMessage,
          heroImage: campaign.heroImage,
          startDate: campaign.startDate,
          endDate: campaign.endDate,
          baseAttempts: Number(campaign.baseAttempts),
          referralDailyLimit: Number(campaign.referralDailyLimit),
          candidateTimeoutMinutes: Number(campaign.candidateTimeoutMinutes),
          terms: campaign.terms,
          shopUrl: campaign.shopUrl || undefined,
          requireOtp: campaign.requireOtp,
          allowReschedule: campaign.allowReschedule,
          status: "active",
        }),
      });
      router.push(`/dashboard/campaigns?campaign=${createdCampaign.slug}`);
      router.refresh();
      setOpen(false);
      setBusiness(emptyBusiness);
      setCampaign({ ...emptyCampaign, businessId: businesses[0]?.id ?? "" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create campaign.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button className="button admin-form-toggle" onClick={() => setOpen(true)} type="button">
        + New Campaign
      </button>
    );
  }

  return (
    <form className="admin-inline-form" onSubmit={handleSubmit}>
      <div className="admin-form-header">
        <strong>New Campaign</strong>
        <button className="button tertiary" onClick={() => setOpen(false)} type="button">
          Cancel
        </button>
      </div>

      <label className="admin-form-toggle-row">
        <input
          checked={creatingBusiness}
          disabled={businesses.length === 0}
          onChange={(event) => setCreatingBusiness(event.target.checked)}
          type="checkbox"
        />
        Create a new business
      </label>

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
          <span>Business</span>
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
            onChange={(event) => setCampaign({ ...campaign, candidateTimeoutMinutes: event.target.value })}
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

      <div className="admin-form-toggles">
        <label className="admin-form-toggle-row">
          <input
            checked={campaign.requireOtp}
            onChange={(event) => setCampaign({ ...campaign, requireOtp: event.target.checked })}
            type="checkbox"
          />
          Require phone OTP verification before issuing a voucher
        </label>
        <label className="admin-form-toggle-row">
          <input
            checked={campaign.allowReschedule}
            onChange={(event) => setCampaign({ ...campaign, allowReschedule: event.target.checked })}
            type="checkbox"
          />
          Allow rescheduling issued reservations
        </label>
      </div>

      {error ? <p className="alert">{error}</p> : null}
      <button className="button" disabled={busy} type="submit">
        {busy ? "Creating..." : "Create Campaign"}
      </button>
    </form>
  );
}
