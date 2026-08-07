import { FormSkeleton } from "../../_components/FormSkeleton";

// Business, campaign details, schedule and hunt rules, content, reservation
// options - the five cards `NewCampaignForm` renders.
export default function Loading() {
  return (
    <FormSkeleton
      cards={[
        { fields: 1 },
        { fields: 3 },
        { fields: 6 },
        { media: true, fields: 2 },
        { fields: 1 },
      ]}
    />
  );
}
