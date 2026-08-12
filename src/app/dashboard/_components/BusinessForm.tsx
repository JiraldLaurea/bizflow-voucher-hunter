"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import type { Business } from "@/types/voucher";
import { FormCard } from "./FormPage";
import { SelectMenu } from "./SelectMenu";
import { appendDone } from "./SlotForm";
import type { Pin } from "./GoogleLocationPicker";

const LocationPicker = dynamic(
  () => import("./GoogleLocationPicker").then((mod) => mod.GoogleLocationPicker),
  {
    ssr: false,
    loading: () => <div className="location-picker-skeleton">Loading map...</div>,
  },
);

const INDUSTRIES = [
  { value: "restaurant", label: "Restaurant" },
  { value: "online_shop", label: "Online Shop" },
  { value: "beauty", label: "Beauty" },
  { value: "pet", label: "Pet" },
  { value: "retail", label: "Retail" },
  { value: "other", label: "Other" },
];

const LIST_HREF = "/dashboard/businesses";

/**
 * Create or edit a venue.
 *
 * One form for both, but not one payload: creating takes the category and the
 * staff PIN, editing takes neither. The category drives how the venue's
 * campaigns present themselves, and the PIN is a credential — changing either
 * from a details form is how you rotate a business's identity by accident.
 */
export function BusinessForm({ business }: { business?: Business }) {
  const router = useRouter();
  const editing = business !== undefined;

  const [name, setName] = useState(business?.name ?? "");
  const [industry, setIndustry] = useState<string>(
    business?.industry ?? "restaurant",
  );
  const [address, setAddress] = useState(business?.address ?? "");
  const [contactNumber, setContactNumber] = useState(business?.contactNumber ?? "");
  const [pin, setPin] = useState<Pin | null>(
    business?.latitude !== undefined && business?.longitude !== undefined
      ? { latitude: business.latitude, longitude: business.longitude }
      : null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (editing) {
        await api(`/api/businesses/${business.id}`, {
          method: "PATCH",
          // null rather than undefined, so clearing the map pin actually clears
          // it: an omitted field means "leave it alone".
          body: JSON.stringify({
            name,
            address,
            contactNumber,
            latitude: pin ? pin.latitude : null,
            longitude: pin ? pin.longitude : null,
          }),
        });
      } else {
        await api("/api/businesses", {
          method: "POST",
          body: JSON.stringify({
            name,
            industry,
            address,
            contactNumber,
            latitude: pin?.latitude,
            longitude: pin?.longitude,
          }),
        });
      }
      router.push(appendDone(LIST_HREF, editing ? "business-saved" : "business-created"));
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : `Unable to ${editing ? "save" : "create"} the business.`,
      );
      setBusy(false);
    }
  }

  const nameField = (
    <label className="field">
      <span>Business name</span>
      <input
        onChange={(event) => setName(event.target.value)}
        placeholder="Glow Lab Skin Clinic"
        required
        value={name}
      />
    </label>
  );

  return (
    <form className="form-page-form" onSubmit={submit}>
      {error ? <p className="alert form-page-alert">{error}</p> : null}

      <FormCard
        title="Identity"
        description="The name customers see on every campaign this business runs."
      >
        {/* Name and category share a row. Editing drops the category, and the
            name is then a direct child of the card body rather than a lone cell
            in a two-column grid — the card's own spacing rules key off that. */}
        {editing ? (
          nameField
        ) : (
          <div className="admin-form-grid">
            {nameField}
            <SelectMenu
              label="Category"
              onChange={setIndustry}
              options={INDUSTRIES}
              value={industry}
            />
          </div>
        )}
      </FormCard>

      <FormCard
        title="Venue details"
        description="Shown to customers on every campaign this business runs. The map pin is what puts it on the directory map."
      >
        {/* Above the address, not below it: the address field carries a map, a
            search button and a hint, so a lone text input after all that reads
            as an afterthought rather than part of the same card. */}
        <label className="field">
          <span>Contact number</span>
          <input
            onChange={(event) => setContactNumber(event.target.value)}
            // Local format rather than +63: the international prefix reads as
            // something you must type. Both are accepted.
            placeholder="09123456789"
            required
            value={contactNumber}
          />
        </label>

        <LocationPicker
          address={address}
          onAddressChange={setAddress}
          onPinChange={setPin}
          pin={pin}
        />
      </FormCard>

      <div className="form-page-actions">
        <Link className="button secondary" href={LIST_HREF}>
          Cancel
        </Link>
        <button className="button" disabled={busy} type="submit">
          {busy
            ? editing
              ? "Saving..."
              : "Creating..."
            : editing
              ? "Save Changes"
              : "Create Business"}
        </button>
      </div>
    </form>
  );
}
