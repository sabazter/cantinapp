import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ConfiguracionClient } from "./configuracion-client";

export const metadata: Metadata = { title: "Configuración — CantinApp" };

export default async function ConfiguracionPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.rol !== "admin" && session.user.rol !== "superadmin") {
    redirect("/admin/dashboard");
  }

  return <ConfiguracionClient />;
}
