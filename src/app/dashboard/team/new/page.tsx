import { redirect } from "next/navigation";
import { FormPage } from "../../_components/FormPage";
import { TeamMemberForm } from "../../_components/TeamMemberForm";
import { cachedBusinesses, currentSession } from "@/server/dashboard-data";

export const dynamic = "force-dynamic";

export default async function NewTeamMemberPage() {
  const session = await currentSession();
  if (session?.role !== "super_admin") redirect("/dashboard");

  return (
    <FormPage
      backHref="/dashboard/team"
      backLabel="Team"
      description="Someone who can sign in to this console. Staff are scoped to one business; admins can see every business."
      title="New team member"
    >
      <TeamMemberForm businesses={await cachedBusinesses()} />
    </FormPage>
  );
}
