import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/admin-session";
import { listBusinesses } from "@/server/admin";
import { FormPage } from "../../_components/FormPage";
import { TeamMemberForm } from "../../_components/TeamMemberForm";

export const dynamic = "force-dynamic";

export default async function NewTeamMemberPage() {
  const session = await verifyAdminSession(
    cookies().get(ADMIN_SESSION_COOKIE)?.value,
  );
  if (session?.role !== "super_admin") redirect("/dashboard");

  return (
    <FormPage
      backHref="/dashboard/team"
      backLabel="Team"
      description="Someone who can sign in to this console. Staff are scoped to one business; admins can see every business."
      title="New team member"
    >
      <TeamMemberForm businesses={await listBusinesses()} />
    </FormPage>
  );
}
