import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSession,
} from "@/lib/admin-session";
import { listBusinesses } from "@/server/admin";
import { Sidebar } from "./_components/Sidebar";
import { DashboardShell } from "./_components/DashboardShell";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await verifyAdminSession(
    cookies().get(ADMIN_SESSION_COOKIE)?.value,
  );
  if (!session) redirect("/login");
  const staffBusinessName =
    session.role === "staff"
      ? (await listBusinesses()).find((business) =>
          session.businessIds.includes(business.id),
        )?.name
      : undefined;

  return (
    <DashboardShell>
      <Sidebar
        adminEmail={session.email}
        adminName={session.name}
        role={session.role}
        staffBusinessName={staffBusinessName}
      />
      <section className="admin-main">{children}</section>
    </DashboardShell>
  );
}
