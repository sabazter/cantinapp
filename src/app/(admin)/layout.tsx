import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AppSidebar } from "@/components/shared/app-sidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.rol !== "admin" && session.user.rol !== "superadmin") redirect("/login");

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-background">
      <AppSidebar
        nombre={session.user.nombre}
        email={session.user.email}
        rol={session.user.rol}
      />
      <main className="flex-1 overflow-y-auto w-full min-w-0 pb-16 md:pb-0">
        {children}
      </main>
    </div>
  );
}
