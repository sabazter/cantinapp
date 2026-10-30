"use client";

import { useState, useEffect } from "react";
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
  Wallet,
  Building2,
  Shield,
  ClipboardList,
  UserCheck,
  Menu,
  X,
  MoreHorizontal,
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
    { label: "Dashboard",  href: "/admin/dashboard",   icon: LayoutDashboard },
    { label: "Inventario", href: "/admin/inventario",  icon: Package },
    { label: "Alumnos",    href: "/admin/alumnos",     icon: GraduationCap },
    { label: "Abonos",     href: "/admin/abonos",      icon: Wallet },
    { label: "CRM",        href: "/admin/crm/dashboard", icon: UserCheck },
    { label: "Usuarios",   href: "/admin/usuarios",    icon: Users },
    { label: "Reportes",   href: "/admin/reportes",    icon: BarChart3 },
    { label: "Config.",    href: "/admin/configuracion", icon: Settings },
  ],
  superadmin: [
    { label: "Panel global",  href: "/superadmin/dashboard",          icon: Shield        },
    { label: "Cantinas",      href: "/superadmin/cantinas",           icon: Building2     },
    { label: "Usuarios",      href: "/superadmin/usuarios-globales",  icon: Users         },
    { label: "Auditoría",     href: "/superadmin/audit-log",          icon: ClipboardList },
  ],
  vendedor: [
    { label: "Caja (POS)", href: "/caja",   icon: ShoppingCart },
    { label: "Abonos",     href: "/abonos", icon: Wallet },
  ],
  representante: [
    { label: "Mi portal", href: "/portal", icon: LayoutDashboard },
  ],
  profesor: [
    { label: "Mi portal", href: "/portal", icon: LayoutDashboard },
  ],
  directivo: [
    { label: "Reportes", href: "/reportes", icon: BarChart3 },
  ],
  alumno: [
    { label: "Mi cuenta", href: "/alumno", icon: LayoutDashboard },
  ],
};

const ROL_LABEL: Record<string, string> = {
  admin: "Administrador",
  superadmin: "Super Admin",
  vendedor: "Vendedor",
  representante: "Representante",
  directivo: "Directivo",
  profesor: "Profesor",
  alumno: "Alumno",
};

interface AppSidebarProps {
  nombre: string;
  email: string;
  rol: Rol;
}

export function AppSidebar({ nombre, email, rol }: AppSidebarProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const items = NAV_ITEMS[rol] ?? [];

  // Cerrar el drawer en navegación
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Prevenir scroll en fondo cuando el drawer móvil está abierto
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  const initials = nombre
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  // Bottom tabs para vista móvil rápida (máx 4 + botón Menú si hay más)
  const bottomBarItems = items.length <= 4 ? items : items.slice(0, 4);

  return (
    <>
      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* 1. HEADER MÓVIL (visible solo en pantallas < md)                      */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      <header className="flex md:hidden items-center justify-between px-4 py-2.5 border-b bg-card text-card-foreground sticky top-0 z-30 shrink-0 w-full shadow-xs">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 -ml-1 text-muted-foreground hover:text-foreground"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Abrir menú de navegación"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <Link href="/" className="flex items-center gap-2 font-bold tracking-tight text-base">
            <div className="bg-primary/10 p-1.5 rounded-lg text-primary">
              <ChefHat className="h-5 w-5" />
            </div>
            <span>CantinApp</span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[11px] px-2 py-0.5">
            {ROL_LABEL[rol] ?? rol}
          </Badge>
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="rounded-full ring-offset-background transition-opacity hover:opacity-80 focus:outline-none"
          >
            <Avatar className="h-8 w-8 border border-border">
              <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
          </button>
        </div>
      </header>

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* 2. DRAWER OFF-CANVAS MÓVIL CON BACKDROP (solo cuando open=true)        */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex animate-in fade-in duration-200">
          {/* Backdrop oscurecido */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Panel deslizante */}
          <aside className="relative flex flex-col w-[290px] max-w-[85vw] h-full bg-card text-card-foreground border-r shadow-2xl z-50">
            {/* Header del menú móvil */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b">
              <div className="flex items-center gap-2 font-bold">
                <div className="bg-primary/10 p-1.5 rounded-lg text-primary">
                  <ChefHat className="h-5 w-5" />
                </div>
                <span className="text-base tracking-tight">CantinApp</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Cerrar menú"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Perfil del usuario activo */}
            <div className="p-4 bg-muted/30 border-b flex items-center gap-3">
              <Avatar className="h-10 w-10 border shrink-0">
                <AvatarFallback className="text-sm font-bold bg-primary text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{nombre}</p>
                <p className="truncate text-xs text-muted-foreground">{email}</p>
                <Badge variant="outline" className="text-[10px] mt-1 font-medium">
                  {ROL_LABEL[rol] ?? rol}
                </Badge>
              </div>
            </div>

            {/* Enlaces de navegación táctiles */}
            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              <p className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Navegación
              </p>
              {items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground active:bg-muted/80"
                    )}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <Separator />

            {/* Acciones de sesión */}
            <div className="p-3 space-y-1.5 bg-card">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2.5 text-destructive hover:bg-destructive/10 hover:text-destructive h-10"
                onClick={() => {
                  setMobileMenuOpen(false);
                  signOut({ callbackUrl: "/login" });
                }}
              >
                <LogOut className="h-4 w-4 shrink-0" />
                Cerrar sesión
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2.5 text-xs text-muted-foreground hover:text-destructive h-9"
                onClick={async () => {
                  if (!confirm("¿Cerrar todas las sesiones activas?")) return;
                  await fetch("/api/auth/sesiones", { method: "DELETE" });
                  toast.success("Sesiones revocadas");
                  signOut({ callbackUrl: "/login" });
                }}
              >
                <ShieldOff className="h-3.5 w-3.5 shrink-0" />
                Cerrar todas las sesiones
              </Button>
            </div>
          </aside>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* 3. SIDEBAR ESCRITORIO PERMANENTE (visible solo en pantallas >= md)     */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:border-r bg-card text-card-foreground md:h-screen shrink-0 shadow-xs">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-6 py-4">
          <div className="bg-primary/10 p-2 rounded-xl text-primary">
            <ChefHat className="h-6 w-6" />
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight block leading-tight">CantinApp</span>
            <span className="text-[11px] text-muted-foreground font-medium">Gestión de Cantinas</span>
          </div>
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
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground shadow-xs font-semibold"
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
        <div className="flex flex-col gap-2.5 p-4 bg-muted/20">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="h-9 w-9 shrink-0 border">
              <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{nombre}</p>
              <p className="truncate text-xs text-muted-foreground">{email}</p>
            </div>
          </div>
          <Badge variant="secondary" className="w-fit text-xs font-medium">
            {ROL_LABEL[rol] ?? rol}
          </Badge>
          <div className="space-y-1 pt-1">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
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
        </div>
      </aside>

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* 4. BARRA DE NAVEGACIÓN INFERIOR EN TELÉFONOS (Bottom Tab Bar)           */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {items.length > 1 && (
        <nav
          aria-label="Navegación móvil inferior"
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t flex items-center justify-around py-1.5 px-2 safe-bottom shadow-lg"
        >
          {bottomBarItems.map((item) => {
            const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href + "/"));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-md text-[11px] font-medium transition-colors",
                  active
                    ? "text-primary font-bold"
                    : "text-muted-foreground hover:text-foreground active:scale-95"
                )}
              >
                <item.icon className={cn("h-5 w-5 mb-0.5", active && "stroke-[2.5]")} />
                <span className="truncate max-w-[65px]">{item.label}</span>
              </Link>
            );
          })}

          {/* Si hay más de 4 items, botón para abrir drawer completo */}
          {items.length > 4 && (
            <button
              onClick={() => setMobileMenuOpen(true)}
              className={cn(
                "flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-md text-[11px] font-medium transition-colors text-muted-foreground hover:text-foreground active:scale-95",
                mobileMenuOpen && "text-primary font-bold"
              )}
            >
              <MoreHorizontal className="h-5 w-5 mb-0.5" />
              <span>Más</span>
            </button>
          )}
        </nav>
      )}
    </>
  );
}
