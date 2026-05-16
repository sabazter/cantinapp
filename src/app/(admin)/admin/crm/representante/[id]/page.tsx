import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import CrmRepresentanteClient from "./crm-representante-client";

export default async function CrmRepresentantePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || !["admin", "superadmin"].includes(session.user.rol)) redirect("/login");
  const { id } = await params;
  return <CrmRepresentanteClient representanteId={id} />;
}
