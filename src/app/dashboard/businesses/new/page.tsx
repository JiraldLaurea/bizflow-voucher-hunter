import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/admin-session";
import { BusinessForm } from "../../_components/BusinessForm";
import { FormPage } from "../../_components/FormPage";

export default async function NewBusinessPage() {
  const session = await verifyAdminSession(
    cookies().get(ADMIN_SESSION_COOKIE)?.value,
  );
  if (session?.role === "staff") redirect("/dashboard");

  return (
    <FormPage
      backHref="/dashboard/businesses"
      backLabel="Businesses"
      description="A venue that can run campaigns. The address and contact number here are shown to customers on every campaign it runs."
      title="New business"
    >
      <BusinessForm />
    </FormPage>
  );
}
