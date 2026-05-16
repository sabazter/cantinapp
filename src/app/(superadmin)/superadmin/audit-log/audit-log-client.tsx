"use client";

import { useCallback, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Search, Shield, ChevronLeft, ChevronRight } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface LogEntry {
  id:        string;
  evento:    string;
  entidad:   string | null;
  entidadId: string | null;
  ip:        string | null;
  createdAt: string;
  cantinaId: string | null;
  usuario: {
    id:     string;
    nombre: string;
    email:  string;
    rol:    string;
  } | null;
}

interface AuditData {
  logs:  LogEntry[];
  total: number;
  page:  number;
  pages: number;
}

// ── Evento badge color ─────────────────────────────────────────────────────────

function eventoBadgeVariant(evento: string): "default" | "secondary" | "destructive" | "outline" {
  if (evento.includes("login_exitoso"))      return "secondary";
  if (evento.includes("login_fallido"))      return "destructive";
  if (evento.includes("eliminad"))           return "destructive";
  if (evento.includes("creado") || evento.includes("confirmado")) return "default";
  return "outline";
}

// ── Component ──────────────────────────────────────────────────────────────────

export function AuditLogClient() {
  const [data,      setData]      = useState<AuditData | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [eventoQ,   setEventoQ]   = useState("");
  const [page,      setPage]      = useState(1);

  const load = useCallback(async (evento: string, p: number) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p) });
    if (evento) params.set("evento", evento);
    const res = await fetch(`/api/superadmin/audit-log?${params}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => load(eventoQ, page), 300);
    return () => clearTimeout(timer);
  }, [eventoQ, page, load]);

  // Reset a pág 1 al cambiar filtro
  useEffect(() => { setPage(1); }, [eventoQ]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Registro de auditoría</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Historial inmutable de todas las operaciones críticas del sistema
        </p>
      </div>

      {/* Filtro */}
      <div className="relative w-full max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          className="pl-8 h-8 text-sm"
          placeholder="Filtrar por tipo de evento..."
          value={eventoQ}
          onChange={e => setEventoQ(e.target.value)}
        />
      </div>

      {/* Tabla */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            {data ? `${data.total.toLocaleString()} registros` : "Cargando..."}
          </CardTitle>
          {data && data.pages > 1 && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                disabled={page <= 1 || loading}
                onClick={() => setPage(p => p - 1)}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="tabular-nums px-2">
                {page} / {data.pages}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                disabled={page >= data.pages || loading}
                onClick={() => setPage(p => p + 1)}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Cargando registros...</span>
            </div>
          ) : !data || data.logs.length === 0 ? (
            <p className="text-center text-muted-foreground py-10 text-sm">Sin registros</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha / Hora</TableHead>
                    <TableHead>Evento</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Entidad</TableHead>
                    <TableHead>IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.logs.map(log => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString("es-VE", {
                          day:    "2-digit",
                          month:  "2-digit",
                          year:   "2-digit",
                          hour:   "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={eventoBadgeVariant(log.evento)}
                          className="text-[10px] font-mono"
                        >
                          {log.evento}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.usuario ? (
                          <div>
                            <p className="font-medium leading-none">{log.usuario.nombre}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{log.usuario.email}</p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/50 text-xs">Sistema</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {log.entidad && log.entidadId ? (
                          <span>
                            <span className="font-medium">{log.entidad}</span>
                            <span className="font-mono ml-1 opacity-60">
                              {log.entidadId.slice(-6)}
                            </span>
                          </span>
                        ) : (
                          <span className="opacity-40">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {log.ip ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
