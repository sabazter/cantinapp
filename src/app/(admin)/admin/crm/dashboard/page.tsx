import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import CrmDashboardClient from "./crm-dashboard-client";

export default async function CrmDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session || !["admin", "superadmin"].includes(session.user.rol)) redirect("/login");
  return <CrmDashboardClient />;
}
