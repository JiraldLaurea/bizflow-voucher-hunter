"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FiEdit2, FiMapPin, FiPhone, FiPlus } from "react-icons/fi";
import { api } from "@/lib/api-client";
import type { Business, Campaign } from "@/types/voucher";
import { AdminModal } from "./AdminModal";

const INDUSTRIES = [
  ["restaurant", "Restaurant"],
  ["online_shop", "Online Shop"],
  ["beauty", "Beauty"],
  ["pet", "Pet"],
  ["retail", "Retail"],
  ["other", "Other"],
] as const;

const emptyDraft = {
  name: "",
  logoText: "",
  industry: "restaurant",
  staffPin: "",
  address: "",
  contactNumber: "",
};

function errorMessage(caught: unknown, fallback: string) {
  return caught instanceof Error ? caught.message : fallback;
}

/**
 * The businesses list and its create/edit flows.
 *
 * Each business is edited in its own modal rather than through a picker on a
 * shared form: a dropdown that silently changes what you are editing makes it
 * easy to save one venue's address onto another.
 */
export function BusinessManager({
  businesses,
  campaigns,
}: {
  businesses: Business[];
  campaigns: Campaign[];
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Business | null>(null);

  return (
    <>
      <section className="panel table-wrap">
        <div className="admin-topbar">
          <div>
            <h2>Businesses</h2>
            <p className="muted">
              The venues behind your campaigns. Address and contact number are
              shown to customers on every campaign the business runs.
            </p>
          </div>
          <button
            className="button"
            onClick={() => setCreating(true)}
            type="button"
          >
            <FiPlus aria-hidden="true" /> New Business
          </button>
        </div>

        <table className="admin-table">
          <thead>
            <tr>
              <th>Business</th>
              <th>Category</th>
              <th>Address</th>
              <th>Contact</th>
              <th>Campaigns</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {businesses.length === 0 ? (
              <tr>
                <td className="muted" colSpan={6}>
                  No businesses yet. Create one to start running campaigns.
                </td>
              </tr>
            ) : (
              businesses.map((business) => {
                const count = campaigns.filter(
                  (campaign) => campaign.businessId === business.id,
                ).length;
                return (
                  <tr key={business.id}>
                    <td>
                      <strong>{business.name}</strong>
                      <div className="muted business-logo-text">
                        {business.logoText}
                      </div>
                    </td>
                    <td>
                      {INDUSTRIES.find(
                        ([value]) => value === business.industry,
                      )?.[1] ?? business.industry}
                    </td>
                    <td>
                      {business.address ? (
                        business.address
                      ) : (
                        <span className="muted">Not set</span>
                      )}
                    </td>
                    <td>
                      {business.contactNumber ? (
                        business.contactNumber
                      ) : (
                        <span className="muted">Not set</span>
                      )}
                    </td>
                    <td>{count}</td>
                    <td>
                      <button
                        className="button secondary"
                        onClick={() => setEditing(business)}
                        type="button"
                      >
                        <FiEdit2 aria-hidden="true" /> Edit
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>

      {creating ? (
        <CreateBusinessModal
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            router.refresh();
          }}
        />
      ) : null}

      {editing ? (
        <EditBusinessModal
          business={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}

function CreateBusinessModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [draft, setDraft] = useState(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/businesses", {
        method: "POST",
        body: JSON.stringify(draft),
      });
      onCreated();
    } catch (caught) {
      setError(errorMessage(caught, "Unable to create the business."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminModal
      onClose={onClose}
      subtitle="A venue that can run campaigns. Details can be changed later."
      title="New Business"
    >
      <form className="modal-form" onSubmit={submit}>
        <div className="modal-body">
          <label className="field">
            <span>Business name</span>
            <input
              onChange={(event) =>
                setDraft({ ...draft, name: event.target.value })
              }
              required
              value={draft.name}
            />
          </label>

          <div className="admin-form-grid">
            <label className="field">
              <span>Logo text (max 4)</span>
              <input
                maxLength={4}
                onChange={(event) =>
                  setDraft({ ...draft, logoText: event.target.value })
                }
                required
                value={draft.logoText}
              />
            </label>
            <label className="field">
              <span>Category</span>
              <select
                onChange={(event) =>
                  setDraft({ ...draft, industry: event.target.value })
                }
                value={draft.industry}
              >
                {INDUSTRIES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="field">
            <span>Staff PIN (4-6 digits)</span>
            <input
              onChange={(event) =>
                setDraft({ ...draft, staffPin: event.target.value })
              }
              required
              value={draft.staffPin}
            />
            <small className="muted">
              Staff enter this to validate vouchers.
            </small>
          </label>

          <VenueFields
            address={draft.address}
            contactNumber={draft.contactNumber}
            onAddress={(address) => setDraft({ ...draft, address })}
            onContactNumber={(contactNumber) =>
              setDraft({ ...draft, contactNumber })
            }
          />
        </div>

        <div className="modal-footer">
          {error ? <p className="alert">{error}</p> : null}
          <button className="button secondary" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="button" disabled={busy} type="submit">
            {busy ? "Creating..." : "Create Business"}
          </button>
        </div>
      </form>
    </AdminModal>
  );
}

function EditBusinessModal({
  business,
  onClose,
  onSaved,
}: {
  business: Business;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(business.name);
  const [address, setAddress] = useState(business.address ?? "");
  const [contactNumber, setContactNumber] = useState(
    business.contactNumber ?? "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/api/businesses/${business.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name, address, contactNumber }),
      });
      onSaved();
    } catch (caught) {
      setError(errorMessage(caught, "Unable to save the business."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminModal
      onClose={onClose}
      subtitle="Changes apply to every campaign this business runs."
      title={`Edit ${business.name}`}
    >
      <form className="modal-form" onSubmit={submit}>
        <div className="modal-body">
          <label className="field">
            <span>Business name</span>
            <input
              onChange={(event) => setName(event.target.value)}
              required
              value={name}
            />
          </label>

          <VenueFields
            address={address}
            contactNumber={contactNumber}
            onAddress={setAddress}
            onContactNumber={setContactNumber}
          />

          {/* Category and staff PIN are absent on purpose: the category drives
            campaign presentation, and the PIN is a credential that belongs in a
            rotation flow rather than a details form. */}
        </div>

        <div className="modal-footer">
          {error ? <p className="alert">{error}</p> : null}
          <button className="button secondary" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="button" disabled={busy} type="submit">
            {busy ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </AdminModal>
  );
}

function VenueFields({
  address,
  contactNumber,
  onAddress,
  onContactNumber,
}: {
  address: string;
  contactNumber: string;
  onAddress: (value: string) => void;
  onContactNumber: (value: string) => void;
}) {
  return (
    <>
      <label className="field">
        <span>
          <FiMapPin aria-hidden="true" /> Address
        </span>
        <input
          onChange={(event) => onAddress(event.target.value)}
          placeholder="123 Ayala Ave, Makati City"
          value={address}
        />
        <small className="muted">
          Shown on the campaign page; customers tap it to open Google Maps.
          Write it as you would search for it.
        </small>
      </label>

      <label className="field">
        <span>
          <FiPhone aria-hidden="true" /> Contact number
        </span>
        <input
          onChange={(event) => onContactNumber(event.target.value)}
          placeholder="+63 2 8123 4567"
          value={contactNumber}
        />
        <small className="muted">Customers tap to call.</small>
      </label>
    </>
  );
}
