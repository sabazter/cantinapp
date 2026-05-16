import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AppSidebar } from "@/components/shared/app-sidebar";

export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.rol !== "superadmin") redirect("/login");

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar
        nombre={session.user.nombre}
        email={session.user.email}
        rol={session.user.rol}
      />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
