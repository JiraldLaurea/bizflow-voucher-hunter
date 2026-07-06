import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSession,
} from "@/lib/admin-session";
import { Sidebar } from "./_components/Sidebar";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await verifyAdminSession(
    cookies().get(ADMIN_SESSION_COOKIE)?.value,
  );
  if (!session) redirect("/login");

  return (
    <main className="admin-shell">
      <Sidebar adminEmail={session.email} adminName={session.name} />
      <section className="admin-main">{children}</section>
    </main>
  );
}
