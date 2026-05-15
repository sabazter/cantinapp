import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Iniciar sesión — CantinApp" };

const ROLE_REDIRECTS: Record<string, string> = {
  admin: "/admin/dashboard",
  vendedor: "/caja",
  representante: "/portal",
  directivo: "/reportes",
  superadmin: "/superadmin",
};

export default async function LoginPage() {
  const session = await getSession();
  if (session) {
    redirect(ROLE_REDIRECTS[session.user.rol] ?? "/");
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">CantinApp</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Sistema de gestión para cantinas escolares
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
