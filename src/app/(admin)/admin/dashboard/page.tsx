import { getSession } from "@/lib/auth";
import { DashboardClient } from "./dashboard-client";

export default async function AdminDashboardPage() {
  const session = await getSession();
  return <DashboardClient nombreAdmin={session?.user.nombre ?? "Admin"} />;
}
