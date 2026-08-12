import { FiEdit2 } from "react-icons/fi";
import type { Business, Campaign } from "@/types/voucher";
import { FormLink } from "./FormLink";

const INDUSTRIES = [
  ["restaurant", "Restaurant"],
  ["online_shop", "Online Shop"],
  ["beauty", "Beauty"],
  ["pet", "Pet"],
  ["retail", "Retail"],
  ["other", "Other"],
] as const;

export function BusinessManager({
  businesses,
  campaigns,
}: {
  businesses: Business[];
  campaigns: Campaign[];
}) {
  return (
      <section className="panel table-wrap">
        {/* Left-aligned at the top of the panel, matching the New Campaign
            trigger on the campaigns page rather than sitting in the top-right.
            The page heading lives outside the panel, as on every other page. */}
        <FormLink
          className="button admin-form-toggle"
          href="/dashboard/businesses/new"
          skeleton="newBusiness"
        >
          New Business
        </FormLink>

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
                    <td className="business-actions">
                      <FormLink
                        className="campaign-edit-image-button"
                        href={`/dashboard/businesses/${business.id}/edit`}
                        skeleton="editBusiness"
                      >
                        <FiEdit2 aria-hidden="true" /> Edit
                      </FormLink>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>
  );
}
