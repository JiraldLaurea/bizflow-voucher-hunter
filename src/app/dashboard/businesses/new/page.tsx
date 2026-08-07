import { redirect } from "next/navigation";
import { BusinessForm } from "../../_components/BusinessForm";
import { FormPage } from "../../_components/FormPage";
import { currentSession } from "@/server/dashboard-data";

export default async function NewBusinessPage() {
  const session = await currentSession();
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
