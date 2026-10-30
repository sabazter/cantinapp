"use client";

import { useEffect, useState } from "react";
import {
  Wallet, QrCode, ShoppingBag, Clock, User,
  CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { QrCarnetCard } from "@/components/shared/qr-carnet-card";

interface AlumnoData {
  id: string;
  nombre: string;
  curso: string;
  seccion: string | null;
  saldo: number;
  telefono: string | null;
}

interface DetalleVentaItem {
  id: string;
  cantidad: number;
  precio_usd_unitario: number;
  productos: { nombre: string } | null;
}

interface Venta {
  id: string;
  total_usd: number;
  total_bs: number;
  tasa_bcv: number;
  metodo_pago: string;
  es_fiado: boolean;
  created_at: string;
  vendedor: { nombre: string } | null;
  detalle_ventas: DetalleVentaItem[];
}

export default function AlumnoPortalPage() {
  const [alumno, setAlumno]         = useState<AlumnoData | null>(null);
  const [ventas, setVentas]         = useState<Venta[]>([]);
  const [loading, setLoading]       = useState(true);
  const [activeTab, setActiveTab]   = useState<"carnet" | "compras">("carnet");
  const [expandedVenta, setExpandedVenta] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/alumno")
      .then((r) => r.json())
      .then((d) => {
        if (d.alumno) {
          setAlumno(d.alumno);
          setVentas(d.ventas ?? []);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-sm font-medium">Cargando tu cuenta escolar...</span>
      </div>
    );
  }

  if (!alumno) {
    return (
      <div className="p-6 text-center max-w-md mx-auto space-y-3">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
        <h2 className="text-lg font-bold">Perfil no vinculado</h2>
        <p className="text-sm text-muted-foreground">
          No se encontró una ficha de alumno asociada a este usuario. Contacta a tu representante o al personal de la cantina.
        </p>
      </div>
    );
  }

  const saldoPositivo = alumno.saldo >= 0;

  return (
    <div className="p-4 sm:p-6 max-w-lg mx-auto space-y-5">
      {/* Saludo y bienvenida */}
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">¡Hola, {alumno.nombre.split(" ")[0]}!</h1>
        <p className="text-xs text-muted-foreground">
          {alumno.curso} {alumno.seccion ? `• Sección ${alumno.seccion}` : ""}
        </p>
      </div>

      {/* Tarjeta de Saldo */}
      <Card className="border shadow-md overflow-hidden bg-gradient-to-b from-card to-muted/20">
        <CardContent className="p-6 text-center space-y-2">
          <div className="flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Wallet className="h-4 w-4 text-primary" />
            <span>{saldoPositivo ? "Saldo Disponible para Consumos" : "Saldo Pendiente (Fiado)"}</span>
          </div>

          <div
            className={`text-4xl font-extrabold font-mono tracking-tight ${
              saldoPositivo ? "text-emerald-600" : "text-destructive"
            }`}
          >
            ${Math.abs(alumno.saldo).toFixed(2)}
          </div>

          <p className="text-xs text-muted-foreground">
            {saldoPositivo
              ? "Fondos listos para consumir en la cantina presentando tu carnet QR"
              : "Este monto está pendiente de pago por tu representante"}
          </p>
        </CardContent>
      </Card>

      {/* Selector de pestañas móvil */}
      <div className="grid grid-cols-2 gap-2 bg-muted p-1 rounded-xl">
        <button
          onClick={() => setActiveTab("carnet")}
          className={`py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
            activeTab === "carnet"
              ? "bg-background text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <QrCode className="h-4 w-4" />
          Mi Carnet QR
        </button>

        <button
          onClick={() => setActiveTab("compras")}
          className={`py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
            activeTab === "compras"
              ? "bg-background text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <ShoppingBag className="h-4 w-4" />
          Mis Consumos ({ventas.length})
        </button>
      </div>

      {/* Contenido: Carnet QR */}
      {activeTab === "carnet" && (
        <div className="space-y-3">
          <QrCarnetCard
            alumnoId={alumno.id}
            nombre={alumno.nombre}
            curso={alumno.curso}
            seccion={alumno.seccion}
            telefono={alumno.telefono}
          />
        </div>
      )}

      {/* Contenido: Compras Detalladas */}
      {activeTab === "compras" && (
        <div className="space-y-3">
          {ventas.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground border rounded-xl bg-card">
              No tienes compras registradas todavía.
            </div>
          ) : (
            ventas.map((v) => {
              const isExpanded = expandedVenta === v.id;
              const fecha = new Date(v.created_at).toLocaleString("es-VE", {
                dateStyle: "medium",
                timeStyle: "short",
              });

              return (
                <Card
                  key={v.id}
                  className="border shadow-2xs overflow-hidden transition-all hover:border-primary/40"
                >
                  <button
                    onClick={() => setExpandedVenta(isExpanded ? null : v.id)}
                    className="w-full text-left p-4 flex items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-base text-foreground">
                          ${Number(v.total_usd).toFixed(2)}
                        </span>
                        <Badge
                          variant={v.es_fiado ? "destructive" : "secondary"}
                          className="text-[10px] uppercase font-bold"
                        >
                          {v.es_fiado ? "Fiado" : "Saldo"}
                        </Badge>
                      </div>

                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{fecha}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground">
                        Bs. {Number(v.total_bs).toFixed(1)}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </button>

                  {/* Desglose detallado de los productos consumidos */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 border-t bg-muted/20 space-y-2 text-xs">
                      {v.vendedor && (
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium pt-1">
                          <User className="h-3 w-3 text-primary" />
                          <span>Atendido por: {v.vendedor.nombre}</span>
                        </div>
                      )}

                      <div className="divide-y divide-border/60 pt-1">
                        {v.detalle_ventas.map((d) => (
                          <div key={d.id} className="py-1.5 flex justify-between items-center">
                            <div>
                              <span className="font-semibold text-foreground">
                                {d.productos?.nombre ?? "Producto"}
                              </span>
                              <span className="text-muted-foreground ml-1.5 font-mono text-[11px]">
                                × {d.cantidad}
                              </span>
                            </div>
                            <span className="font-mono font-medium text-foreground">
                              ${(d.cantidad * Number(d.precio_usd_unitario)).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="flex justify-between pt-2 border-t font-semibold text-[11px] text-muted-foreground">
                        <span>Tasa BCV del momento:</span>
                        <span>{Number(v.tasa_bcv).toFixed(2)} Bs/$</span>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
