import type { ReactNode } from "react";
import { Sidebar } from "./_components/Sidebar";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <main className="admin-shell">
      <Sidebar />
      <section className="admin-main">{children}</section>
    </main>
  );
}
