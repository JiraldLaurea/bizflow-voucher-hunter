import type { Campaign } from "@/types/voucher";

export function CampaignSwitcher({
  campaigns,
  selectedSlug,
  action,
}: {
  campaigns: Campaign[];
  selectedSlug: string;
  action: string;
}) {
  if (campaigns.length === 0) return null;

  return (
    <form className="campaign-switcher" action={action}>
      <label>
        <span>Viewing campaign</span>
        <select name="campaign" defaultValue={selectedSlug}>
          {campaigns.map((campaign) => (
            <option key={campaign.id} value={campaign.slug}>
              {campaign.title}
            </option>
          ))}
        </select>
      </label>
      <button className="button secondary" type="submit">
        View
      </button>
    </form>
  );
}
