"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, User, Users, CreditCard, MessageSquare,
  CheckCircle, AlertCircle, XCircle, Phone, Mail, Save,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────────────
interface Representante {
  id: string; nombre: string; email: string; telefono: string | null;
  activo: boolean; emailVerificado: boolean; notasCrm: string; createdAt: string;
}
interface Hijo {
  id: string; nombre: string; curso: string; seccion: string | null;
  activo: boolean; fiadoHabilitado: boolean; saldo: number;
}
interface AbonoRow {
  id: string; alumnoNombre: string; montoUsd: number; metodo: string;
  estado: string; createdAt: string;
}
interface Perfil {
  representante: Representante;
  hijos: Hijo[];
  abonos: {
    historial: AbonoRow[];
    totalAbonadoUsd: number;
    totalConfirmados: number;
    totalRechazados: number;
  };
  comunicacion: {
    canalPreferido: string;
    totalNotificaciones: number;
    emailCount: number;
    whatsappCount: number;
  };
  financiero: {
    deudaTotalHijos: number;
    calificacion: "excelente" | "buena" | "regular" | "baja";
  };
}

// ─── Config ──────────────────────────────────────────────────────────────────
const CALIFICACION = {
  excelente: { label: "Responsabilidad excelente", color: "bg-emerald-100 text-emerald-800", icon: <CheckCircle className="w-4 h-4" /> },
  buena:     { label: "Buena responsabilidad",     color: "bg-blue-100 text-blue-800",       icon: <CheckCircle className="w-4 h-4" /> },
  regular:   { label: "Responsabilidad regular",   color: "bg-amber-100 text-amber-800",     icon: <AlertCircle className="w-4 h-4" /> },
  baja:      { label: "Baja responsabilidad",      color: "bg-red-100 text-red-800",         icon: <XCircle className="w-4 h-4" /> },
};

const ESTADO_ABONO: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  confirmado: { label: "Confirmado", variant: "default" },
  pendiente:  { label: "Pendiente",  variant: "secondary" },
  rechazado:  { label: "Rechazado",  variant: "destructive" },
};

export default function CrmRepresentanteClient({ representanteId }: { representanteId: string }) {
  const router = useRouter();
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [loading, setLoading] = useState(true);
  const [notas, setNotas] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/crm/representante/${representanteId}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { toast.error(d.error); return; }
        setPerfil(d);
        setNotas(d.representante.notasCrm ?? "");
      })
      .catch(() => toast.error("Error de red"))
      .finally(() => setLoading(false));
  }, [representanteId]);

  const guardarNotas = async () => {
    setGuardando(true);
    const res = await fetch(`/api/admin/crm/representante/${representanteId}/notas`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notas }),
    });
    setGuardando(false);
    if (res.ok) toast.success("Notas guardadas");
    else toast.error("Error al guardar notas");
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Cargando…</div>;
  if (!perfil)  return <div className="flex items-center justify-center h-64 text-destructive">Error cargando perfil</div>;

  const { representante: rep, hijos, abonos, comunicacion, financiero } = perfil;
  const calConf = CALIFICACION[financiero.calificacion];

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{rep.nombre}</h1>
          <p className="text-muted-foreground text-sm">Representante · CRM Perfil</p>
        </div>
        <div className="ml-auto">
          <Badge className={`flex items-center gap-1 ${calConf.color}`}>
            {calConf.icon} {calConf.label}
          </Badge>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Hijos"              value={hijos.length.toString()} />
        <KpiCard label="Total abonado"      value={`$${abonos.totalAbonadoUsd.toFixed(2)}`} />
        <KpiCard label="Deuda hijos"
          value={`$${financiero.deudaTotalHijos.toFixed(2)}`}
          valueClass={financiero.deudaTotalHijos > 0 ? "text-destructive" : "text-emerald-600"}
        />
        <KpiCard label="Notificaciones"     value={comunicacion.totalNotificaciones.toString()} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Datos del representante */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><User className="w-4 h-4" /> Datos del representante</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <InfoRow label="Nombre"   value={rep.nombre} />
            <InfoRow label="Email"    value={rep.email} icon={<Mail className="w-3 h-3" />} />
            <InfoRow label="Teléfono" value={rep.telefono ?? "No registrado"} icon={<Phone className="w-3 h-3" />} />
            <InfoRow label="Miembro desde" value={new Date(rep.createdAt).toLocaleDateString("es-VE")} />
            <Separator />
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Email verificado</span>
              <Badge variant={rep.emailVerificado ? "default" : "outline"}>
                {rep.emailVerificado ? "Verificado" : "Pendiente"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Comunicación */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><MessageSquare className="w-4 h-4" /> Comunicación</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <InfoRow label="Canal preferido" value={comunicacion.canalPreferido === "whatsapp" ? "WhatsApp" : "Email"} />
            <InfoRow label="Notificaciones WhatsApp" value={comunicacion.whatsappCount.toString()} />
            <InfoRow label="Notificaciones Email"    value={comunicacion.emailCount.toString()} />
            <Separator />
            <InfoRow label="Abonos confirmados" value={abonos.totalConfirmados.toString()} />
            <InfoRow
              label="Abonos rechazados"
              value={abonos.totalRechazados.toString()}
              valueClass={abonos.totalRechazados > 0 ? "text-destructive" : ""}
            />
          </CardContent>
        </Card>
      </div>

      {/* Vista familiar */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Users className="w-4 h-4" /> Hijos registrados</CardTitle></CardHeader>
        <CardContent>
          {hijos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Sin hijos registrados</p>
          ) : (
            <div className="divide-y">
              {hijos.map(h => (
                <div key={h.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">{h.nombre}</p>
                    <p className="text-xs text-muted-foreground">{h.curso}{h.seccion ? ` · ${h.seccion}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-mono font-medium ${h.saldo < 0 ? "text-destructive" : "text-emerald-600"}`}>
                      ${h.saldo.toFixed(2)}
                    </span>
                    <Button size="sm" variant="outline" onClick={() => router.push(`/admin/crm/${h.id}`)}>
                      Ver perfil
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Historial de abonos */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CreditCard className="w-4 h-4" /> Historial de abonos</CardTitle></CardHeader>
        <CardContent>
          {abonos.historial.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Sin abonos registrados</p>
          ) : (
            <div className="divide-y">
              {abonos.historial.map(a => {
                const conf = ESTADO_ABONO[a.estado] ?? ESTADO_ABONO.pendiente;
                return (
                  <div key={a.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium">${a.montoUsd.toFixed(2)} <span className="text-muted-foreground text-xs">· {a.alumnoNombre}</span></p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {a.metodo.replace(/_/g, " ")} · {new Date(a.createdAt).toLocaleDateString("es-VE")}
                      </p>
                    </div>
                    <Badge variant={conf.variant}>{conf.label}</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notas internas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notas internas (solo visible para admin)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={notas}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotas(e.target.value)}
            placeholder="Observaciones internas sobre este representante…"
            rows={4}
            maxLength={2000}
          />
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">{notas.length}/2000 caracteres</span>
            <Button size="sm" onClick={guardarNotas} disabled={guardando}>
              <Save className="w-4 h-4 mr-2" />
              {guardando ? "Guardando…" : "Guardar notas"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ label, value, valueClass = "" }: { label: string; value: string; valueClass?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p className={`text-2xl font-bold ${valueClass}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function InfoRow({ label, value, valueClass = "", icon }: {
  label: string; value: string; valueClass?: string; icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium flex items-center gap-1 ${valueClass}`}>{icon}{value}</span>
    </div>
  );
}
