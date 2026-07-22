import { redirect } from "next/navigation";

// Account/More is a single global page now; redirect the old campaign-scoped one.
export default function CampaignMorePage() {
  redirect("/more");
}
