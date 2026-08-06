import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/admin-session";
import { listAdminUsers } from "@/server/admin-users";
import { listBusinesses } from "@/server/admin";
import { FormPage } from "../../../_components/FormPage";
import { TeamMemberForm } from "../../../_components/TeamMemberForm";

export const dynamic = "force-dynamic";

export default async function EditTeamMemberPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await verifyAdminSession(
    cookies().get(ADMIN_SESSION_COOKIE)?.value,
  );
  if (session?.role !== "super_admin") redirect("/dashboard");

  const [members, businesses] = await Promise.all([
    listAdminUsers(),
    listBusinesses(),
  ]);
  const member = members.find((item) => item.id === params.id);
  if (!member) notFound();

  return (
    <FormPage
      backHref="/dashboard/team"
      backLabel="Team"
      description="Role, business access, and password. The email is the login identity and is fixed once the account exists."
      title={`Edit ${member.name}`}
    >
      <TeamMemberForm businesses={businesses} member={member} />
    </FormPage>
  );
}
