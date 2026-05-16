import { NextRequest, NextResponse } from "next/server";
import { requireRole, withAuth } from "@/lib/require-role";
import { createServerSupabase } from "@/lib/supabase-server";

// GET /api/admin/crm/analisis?tipo=productos|cursos|vendedores&dias=30
export const GET = withAuth(async (req: NextRequest, session) => {
  requireRole(session, "admin", "superadmin");
  const cantinaId = session.user.cantinaId!;
  const { searchParams } = new URL(req.url);
  const tipo = searchParams.get("tipo") ?? "productos";
  const dias = Math.min(parseInt(searchParams.get("dias") ?? "30"), 365);
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString();

  const supabase = createServerSupabase();

  if (tipo === "productos") {
    const { data: ventas } = await supabase
      .from("ventas")
      .select("id, total_usd, created_at")
      .eq("cantina_id", cantinaId)
      .is("deleted_at", null)
      .gte("created_at", desde);

    const ventaIds = (ventas ?? []).map(v => v.id);
    if (ventaIds.length === 0) return NextResponse.json({ items: [] });

    const { data: detalles } = await supabase
      .from("detalle_ventas")
      .select("producto_id, cantidad, precio_usd_unitario, productos(nombre, categoria)")
      .in("venta_id", ventaIds);

    const map = new Map<string, {
      nombre: string; categoria: string; volumen: number; ingresos: number;
    }>();
    for (const d of detalles ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = d.productos as any;
      const nombre = p?.nombre ?? "?";
      const categoria = p?.categoria ?? "tienda";
      const prev = map.get(d.producto_id) ?? { nombre, categoria, volumen: 0, ingresos: 0 };
      map.set(d.producto_id, {
        nombre, categoria,
        volumen: prev.volumen + d.cantidad,
        ingresos: prev.ingresos + d.cantidad * Number(d.precio_usd_unitario),
      });
    }
    const items = Array.from(map.values())
      .map(v => ({ ...v, ingresos: Math.round(v.ingresos * 100) / 100 }))
      .sort((a, b) => b.volumen - a.volumen)
      .slice(0, 20);

    return NextResponse.json({ items });
  }

  if (tipo === "cursos") {
    const { data: ventas } = await supabase
      .from("ventas")
      .select("total_usd, created_at, alumnos(curso, seccion)")
      .eq("cantina_id", cantinaId)
      .is("deleted_at", null)
      .gte("created_at", desde)
      .not("alumno_id", "is", null);

    const map = new Map<string, { curso: string; totalUsd: number; count: number }>();
    for (const v of ventas ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const a = v.alumnos as any;
      const curso = a?.curso ?? "Desconocido";
      const prev = map.get(curso) ?? { curso, totalUsd: 0, count: 0 };
      map.set(curso, { curso, totalUsd: prev.totalUsd + Number(v.total_usd), count: prev.count + 1 });
    }
    const items = Array.from(map.values())
      .map(v => ({ ...v, totalUsd: Math.round(v.totalUsd * 100) / 100, promUsd: Math.round(v.totalUsd / Math.max(v.count, 1) * 100) / 100 }))
      .sort((a, b) => b.totalUsd - a.totalUsd);

    // Deuda por curso
    const { data: deudas } = await supabase
      .from("alumnos")
      .select("curso, cuentas_alumnos(saldo)")
      .eq("cantina_id", cantinaId)
      .eq("activo", true)
      .is("deleted_at", null);

    const deudaCurso = new Map<string, number>();
    for (const a of deudas ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const c = a.cuentas_alumnos as any;
      const saldo = Number(Array.isArray(c) ? c[0]?.saldo ?? 0 : c?.saldo ?? 0);
      if (saldo < 0) {
        deudaCurso.set(a.curso, (deudaCurso.get(a.curso) ?? 0) + Math.abs(saldo));
      }
    }

    const itemsConDeuda = items.map(i => ({
      ...i,
      deudaUsd: Math.round((deudaCurso.get(i.curso) ?? 0) * 100) / 100,
    }));

    return NextResponse.json({ items: itemsConDeuda });
  }

  if (tipo === "vendedores") {
    const { data: ventas } = await supabase
      .from("ventas")
      .select("vendedor_id, total_usd, es_fiado, deleted_at, usuarios(nombre)")
      .eq("cantina_id", cantinaId)
      .gte("created_at", desde);

    const map = new Map<string, {
      nombre: string; totalVentas: number; montoUsd: number;
      fiadoUsd: number; anulaciones: number;
    }>();
    for (const v of ventas ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nombre = (v.usuarios as any)?.nombre ?? "?";
      const prev = map.get(v.vendedor_id) ?? { nombre, totalVentas: 0, montoUsd: 0, fiadoUsd: 0, anulaciones: 0 };
      if (v.deleted_at) {
        map.set(v.vendedor_id, { ...prev, anulaciones: prev.anulaciones + 1 });
      } else {
        map.set(v.vendedor_id, {
          ...prev,
          totalVentas: prev.totalVentas + 1,
          montoUsd: prev.montoUsd + Number(v.total_usd),
          fiadoUsd: prev.fiadoUsd + (v.es_fiado ? Number(v.total_usd) : 0),
        });
      }
    }
    const items = Array.from(map.values())
      .map(v => ({
        ...v,
        montoUsd: Math.round(v.montoUsd * 100) / 100,
        fiadoUsd: Math.round(v.fiadoUsd * 100) / 100,
        tasaAnulacion: v.totalVentas > 0 ? Math.round(v.anulaciones / v.totalVentas * 100) / 100 : 0,
      }))
      .sort((a, b) => b.montoUsd - a.montoUsd);

    return NextResponse.json({ items });
  }

  return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
});
