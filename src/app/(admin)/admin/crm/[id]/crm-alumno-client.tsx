"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle, ArrowLeft, Clock, CreditCard, ShoppingBag,
  Star, TrendingUp, User, Wallet, CheckCircle, XCircle, AlertCircle,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────
interface Alumno {
  id: string; nombre: string; curso: string; seccion: string | null;
  fotoUrl: string | null; activo: boolean; fiadoHabilitado: boolean;
  limiteFiadoUsd: number; createdAt: string;
}
interface Metricas {
  totalVentas: number; gastoTotalUsd: number; gastoPromedioSemanalUsd: number;
  frecuenciaDiasConCompra: number; productoFavorito: { nombre: string; cantidadTotal: number } | null;
  horarioTipico: number | null; ultimaCompraAt: string | null; diasSinComprar: number;
}
interface Abono { id: string; montoUsd: number; metodo: string; estado: string; createdAt: string; }
interface Financiero {
  saldoActual: number; totalFiadoUsd: number; totalAbonadoUsd: number;
  calificacion: "excelente" | "bueno" | "regular" | "riesgo";
  historialAbonos: Abono[];
}
interface Alerta { tipo: string; mensaje: string; }
interface Perfil360 {
  alumno: Alumno; cuenta: { saldo: number };
  metricas: Metricas; financiero: Financiero; alertas: Alerta[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const HORA_LABEL = (h: number) => {
  const suffix = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:00 ${suffix}`;
};

const CALIFICACION_CONFIG = {
  excelente: { label: "Excelente pagador", color: "bg-emerald-100 text-emerald-800", icon: <CheckCircle className="w-4 h-4" /> },
  bueno:     { label: "Buen pagador",      color: "bg-blue-100 text-blue-800",     icon: <CheckCircle className="w-4 h-4" /> },
  regular:   { label: "Pagador regular",   color: "bg-amber-100 text-amber-800",   icon: <AlertCircle className="w-4 h-4" /> },
  riesgo:    { label: "En riesgo",         color: "bg-red-100 text-red-800",       icon: <XCircle className="w-4 h-4" /> },
};

const ALERTA_CONFIG: Record<string, { icon: React.ReactNode; color: string }> = {
  deuda_alta:      { icon: <AlertTriangle className="w-4 h-4" />, color: "bg-red-50 border-red-200 text-red-700" },
  inactividad:     { icon: <Clock className="w-4 h-4" />,         color: "bg-amber-50 border-amber-200 text-amber-700" },
  limite_cercano:  { icon: <CreditCard className="w-4 h-4" />,    color: "bg-orange-50 border-orange-200 text-orange-700" },
};

const ESTADO_ABONO: Record<string, { label: string; color: string }> = {
  confirmado: { label: "Confirmado", color: "default" },
  pendiente:  { label: "Pendiente",  color: "secondary" },
  rechazado:  { label: "Rechazado",  color: "destructive" },
};

// ─── Component ───────────────────────────────────────────────────────────────
export default function CrmAlumnoClient({ alumnoId }: { alumnoId: string }) {
  const router = useRouter();
  const [perfil, setPerfil] = useState<Perfil360 | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/crm/alumno/${alumnoId}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return; }
        setPerfil(d);
      })
      .catch(() => setError("Error de red"))
      .finally(() => setLoading(false));
  }, [alumnoId]);

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-muted-foreground">Cargando perfil CRM…</div>
  );
  if (error || !perfil) return (
    <div className="flex items-center justify-center h-64 text-destructive">{error ?? "Error cargando perfil"}</div>
  );

  const { alumno, metricas, financiero, alertas } = perfil;
  const calConf = CALIFICACION_CONFIG[financiero.calificacion];

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{alumno.nombre}</h1>
          <p className="text-muted-foreground text-sm">{alumno.curso}{alumno.seccion ? ` · ${alumno.seccion}` : ""} · CRM Perfil 360°</p>
        </div>
        <div className="ml-auto flex gap-2">
          {!alumno.activo && <Badge variant="destructive">Inactivo</Badge>}
          <Badge className={`flex items-center gap-1 ${calConf.color}`}>
            {calConf.icon} {calConf.label}
          </Badge>
        </div>
      </div>

      {/* Alertas activas */}
      {alertas.length > 0 && (
        <div className="space-y-2">
          {alertas.map((a, i) => {
            const conf = ALERTA_CONFIG[a.tipo] ?? ALERTA_CONFIG.deuda_alta;
            return (
              <div key={i} className={`flex items-center gap-2 border rounded-lg px-4 py-2 text-sm font-medium ${conf.color}`}>
                {conf.icon} {a.mensaje}
              </div>
            );
          })}
        </div>
      )}

      {/* KPIs principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={<ShoppingBag />} label="Total compras" value={metricas.totalVentas.toString()} />
        <KpiCard icon={<TrendingUp />}  label="Gasto total"   value={`$${metricas.gastoTotalUsd.toFixed(2)}`} />
        <KpiCard icon={<Wallet />}      label="Saldo actual"
          value={`$${financiero.saldoActual.toFixed(2)}`}
          valueClass={financiero.saldoActual < 0 ? "text-destructive" : "text-emerald-600"}
        />
        <KpiCard icon={<Star />}        label="Gasto/semana"  value={`$${metricas.gastoPromedioSemanalUsd.toFixed(2)}`} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Comportamiento */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="w-4 h-4" /> Comportamiento de compra</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <InfoRow label="Días de compra / semana" value={`${metricas.frecuenciaDiasConCompra} días`} />
            <InfoRow label="Horario típico"
              value={metricas.horarioTipico !== null ? HORA_LABEL(metricas.horarioTipico) : "Sin datos"}
            />
            <InfoRow label="Producto favorito"
              value={metricas.productoFavorito
                ? `${metricas.productoFavorito.nombre} (×${metricas.productoFavorito.cantidadTotal})`
                : "Sin datos"}
            />
            <InfoRow label="Última compra"
              value={metricas.ultimaCompraAt
                ? `hace ${metricas.diasSinComprar} días (${new Date(metricas.ultimaCompraAt).toLocaleDateString("es-VE")})`
                : "Nunca"}
            />
            <InfoRow label="Días sin comprar" value={metricas.diasSinComprar.toString()}
              valueClass={metricas.diasSinComprar >= 14 ? "text-amber-600 font-semibold" : ""}
            />
          </CardContent>
        </Card>

        {/* Estado financiero */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CreditCard className="w-4 h-4" /> Estado financiero</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <InfoRow label="Saldo"
              value={`$${financiero.saldoActual.toFixed(2)}`}
              valueClass={financiero.saldoActual < 0 ? "text-destructive font-semibold" : "text-emerald-600 font-semibold"}
            />
            <InfoRow label="Total fiado acumulado" value={`$${financiero.totalFiadoUsd.toFixed(2)}`} />
            <InfoRow label="Total abonado"          value={`$${financiero.totalAbonadoUsd.toFixed(2)}`} />
            {alumno.fiadoHabilitado && (
              <InfoRow label="Límite de fiado" value={`$${alumno.limiteFiadoUsd.toFixed(2)}`} />
            )}
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Fiado</span>
              <Badge variant={alumno.fiadoHabilitado ? "default" : "outline"}>
                {alumno.fiadoHabilitado ? "Habilitado" : "Deshabilitado"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Historial de abonos */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Wallet className="w-4 h-4" /> Historial de abonos</CardTitle></CardHeader>
        <CardContent>
          {financiero.historialAbonos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Sin abonos registrados</p>
          ) : (
            <div className="divide-y">
              {financiero.historialAbonos.map(a => {
                const conf = ESTADO_ABONO[a.estado] ?? ESTADO_ABONO.pendiente;
                return (
                  <div key={a.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium">${a.montoUsd.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {a.metodo.replace(/_/g, " ")} · {new Date(a.createdAt).toLocaleDateString("es-VE")}
                      </p>
                    </div>
                    <Badge variant={conf.color as "default" | "secondary" | "destructive" | "outline"}>
                      {conf.label}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info básica */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><User className="w-4 h-4" /> Datos del alumno</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <InfoRow label="Nombre"   value={alumno.nombre} />
          <InfoRow label="Curso"    value={alumno.curso} />
          <InfoRow label="Sección"  value={alumno.seccion ?? "—"} />
          <InfoRow label="Alumno desde" value={new Date(alumno.createdAt).toLocaleDateString("es-VE")} />
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ icon, label, value, valueClass = "" }: {
  icon: React.ReactNode; label: string; value: string; valueClass?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          <span className="w-4 h-4">{icon}</span>
          <span className="text-xs">{label}</span>
        </div>
        <p className={`text-2xl font-bold ${valueClass}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function InfoRow({ label, value, valueClass = "" }: { label: string; value: string; valueClass?: string; }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium ${valueClass}`}>{value}</span>
    </div>
  );
}
