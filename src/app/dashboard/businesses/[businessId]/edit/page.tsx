import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/admin-session";
import { listBusinesses } from "@/server/admin";
import { BusinessForm } from "../../../_components/BusinessForm";
import { FormPage } from "../../../_components/FormPage";

export default async function EditBusinessPage({
  params,
}: {
  params: { businessId: string };
}) {
  const session = await verifyAdminSession(
    cookies().get(ADMIN_SESSION_COOKIE)?.value,
  );
  // Staff validate vouchers for a business; they do not edit its public details.
  if (session?.role === "staff") redirect("/dashboard");

  const business = (await listBusinesses()).find(
    (item) => item.id === params.businessId,
  );
  if (!business) notFound();

  return (
    <FormPage
      backHref="/dashboard/businesses"
      backLabel="Businesses"
      description="Changes apply to every campaign this business runs. Category and staff PIN are set when the business is created."
      title={`Edit ${business.name}`}
    >
      <BusinessForm business={business} />
    </FormPage>
  );
}
