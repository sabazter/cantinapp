import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import CrmClient from "./crm-client";

export default async function CrmPage() {
  const session = await getServerSession(authOptions);
  if (!session || !["admin", "superadmin"].includes(session.user.rol)) redirect("/login");
  return <CrmClient />;
}
