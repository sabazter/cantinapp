"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  GraduationCap,
  BarChart3,
  Settings,
  LogOut,
  ShieldOff,
  ChefHat,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Rol } from "@/generated/prisma/enums";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const NAV_ITEMS: Record<string, NavItem[]> = {
  admin: [
    { label: "Dashboard",  href: "/admin/dashboard", icon: LayoutDashboard },
    { label: "Inventario", href: "/admin/inventario", icon: Package },
    { label: "Alumnos",    href: "/admin/alumnos",    icon: GraduationCap },
    { label: "Usuarios",   href: "/admin/usuarios",   icon: Users },
    { label: "Reportes",   href: "/admin/reportes",   icon: BarChart3 },
    { label: "Config.",    href: "/admin/configuracion", icon: Settings },
  ],
  superadmin: [
    { label: "Dashboard",  href: "/admin/dashboard", icon: LayoutDashboard },
    { label: "Inventario", href: "/admin/inventario", icon: Package },
    { label: "Alumnos",    href: "/admin/alumnos",    icon: GraduationCap },
    { label: "Usuarios",   href: "/admin/usuarios",   icon: Users },
    { label: "Reportes",   href: "/admin/reportes",   icon: BarChart3 },
    { label: "Config.",    href: "/admin/configuracion", icon: Settings },
  ],
  vendedor: [
    { label: "Caja", href: "/caja", icon: ShoppingCart },
  ],
  representante: [
    { label: "Mi portal", href: "/portal", icon: LayoutDashboard },
  ],
  directivo: [
    { label: "Reportes", href: "/reportes", icon: BarChart3 },
  ],
};

const ROL_LABEL: Record<string, string> = {
  admin: "Administrador",
  superadmin: "Super Admin",
  vendedor: "Vendedor",
  representante: "Representante",
  directivo: "Directivo",
};

interface AppSidebarProps {
  nombre: string;
  email: string;
  rol: Rol;
}

export function AppSidebar({ nombre, email, rol }: AppSidebarProps) {
  const pathname = usePathname();
  const items = NAV_ITEMS[rol] ?? [];
  const initials = nombre
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <aside className="flex h-screen w-60 flex-col border-r bg-card text-card-foreground">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-4">
        <ChefHat className="h-6 w-6 text-primary" />
        <span className="text-lg font-semibold tracking-tight">CantinApp</span>
      </div>

      <Separator />

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <Separator />

      {/* User footer */}
      <div className="flex flex-col gap-2 p-4">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{nombre}</p>
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          </div>
        </div>
        <Badge variant="secondary" className="w-fit text-xs">
          {ROL_LABEL[rol] ?? rol}
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-xs text-muted-foreground hover:text-destructive"
          onClick={async () => {
            if (!confirm("¿Cerrar todas las sesiones activas?")) return;
            await fetch("/api/auth/sesiones", { method: "DELETE" });
            toast.success("Sesiones revocadas");
            signOut({ callbackUrl: "/login" });
          }}
        >
          <ShieldOff className="h-3.5 w-3.5" />
          Cerrar todas las sesiones
        </Button>
      </div>
    </aside>
  );
}
