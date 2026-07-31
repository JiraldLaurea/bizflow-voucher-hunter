"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import type { Business } from "@/types/voucher";

/**
 * Edits the venue details customers see on a campaign page.
 *
 * Businesses could previously only be created, never edited, so every business
 * that already existed had no way to gain an address. The staff PIN is not here
 * on purpose: it is a credential, not a detail, and rotating it belongs in its
 * own flow.
 */
export function BusinessDetailsForm({ businesses }: { businesses: Business[] }) {
  const router = useRouter();
  const [businessId, setBusinessId] = useState(businesses[0]?.id ?? "");
  const selected = businesses.find((business) => business.id === businessId);

  const [address, setAddress] = useState(selected?.address ?? "");
  const [contactNumber, setContactNumber] = useState(selected?.contactNumber ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  function selectBusiness(nextId: string) {
    const next = businesses.find((business) => business.id === nextId);
    setBusinessId(nextId);
    // Load the newly selected business's own values rather than carrying the
    // previous one's across, which would silently overwrite on save.
    setAddress(next?.address ?? "");
    setContactNumber(next?.contactNumber ?? "");
    setError("");
    setSaved(false);
  }

  async function save() {
    if (!businessId) return;
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      await api(`/api/businesses/${businessId}`, {
        method: "PATCH",
        body: JSON.stringify({ address, contactNumber }),
      });
      setSaved(true);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save the details.");
    } finally {
      setBusy(false);
    }
  }

  if (businesses.length === 0) {
    return <p className="muted">Create a business first to add its venue details.</p>;
  }

  return (
    <div className="business-details-form">
      <label className="field">
        <span>Business</span>
        <select onChange={(event) => selectBusiness(event.target.value)} value={businessId}>
          {businesses.map((business) => (
            <option key={business.id} value={business.id}>
              {business.name}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Address</span>
        <input
          onChange={(event) => {
            setAddress(event.target.value);
            setSaved(false);
          }}
          placeholder="123 Ayala Ave, Makati City"
          value={address}
        />
        <small className="muted">
          Shown on the campaign page; tapping it opens Google Maps. Write it as you
          would search for it.
        </small>
      </label>

      <label className="field">
        <span>Contact number</span>
        <input
          onChange={(event) => {
            setContactNumber(event.target.value);
            setSaved(false);
          }}
          placeholder="+63 2 8123 4567"
          value={contactNumber}
        />
        <small className="muted">Customers can tap to call.</small>
      </label>

      <div className="business-details-actions">
        <button className="button" disabled={busy || !businessId} onClick={save} type="button">
          {busy ? "Saving..." : "Save details"}
        </button>
        {saved ? <span className="muted">Saved.</span> : null}
      </div>

      {error ? <p className="alert">{error}</p> : null}
    </div>
  );
}
