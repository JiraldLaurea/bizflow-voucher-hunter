import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { cachedBusinesses, currentSession } from "@/server/dashboard-data";
import { Sidebar } from "./_components/Sidebar";
import { DashboardShell } from "./_components/DashboardShell";

// No `force-dynamic`: reading the session cookie already opts every dashboard
// render into dynamic rendering. Declaring it on the layout additionally forced
// the whole subtree to opt out of route prefetching, so each sidebar click
// waited on a cold server render before anything could be shown.

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await currentSession();
  if (!session) redirect("/login");
  const staffBusinessName =
    session.role === "staff"
      ? (await cachedBusinesses()).find((business) =>
          session.businessIds.includes(business.id),
        )?.name
      : undefined;

  // The shell renders `admin-main` itself: it is the region that swaps to a
  // placeholder while a sidebar click is in flight, so it has to own it.
  return (
    <DashboardShell
      sidebar={
        <Sidebar
          adminEmail={session.email}
          adminName={session.name}
          role={session.role}
          staffBusinessName={staffBusinessName}
        />
      }
    >
      {children}
    </DashboardShell>
  );
}
