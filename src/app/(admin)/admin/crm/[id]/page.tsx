import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import CrmAlumnoClient from "./crm-alumno-client";

export default async function CrmAlumnoPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || !["admin", "superadmin"].includes(session.user.rol)) redirect("/login");
  const { id } = await params;
  return <CrmAlumnoClient alumnoId={id} />;
}
