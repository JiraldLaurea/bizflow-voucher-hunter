import { redirect } from "next/navigation";

// Sign-in is now a single global page (/signin). Redirect any old per-campaign
// sign-in link there, returning to this campaign afterwards.
export default function CampaignSignInPage({ params }: { params: { slug: string } }) {
  redirect(`/signin?next=${encodeURIComponent(`/campaign/${params.slug}`)}`);
}
