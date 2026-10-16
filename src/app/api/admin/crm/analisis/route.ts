import { NextRequest, NextResponse } from "next/server";
import { requireRole, withAuth } from "@/lib/require-role";
import { db } from "@/lib/db";

// GET /api/admin/crm/analisis?tipo=productos|cursos|vendedores&dias=30
export const GET = withAuth(async (req: NextRequest, session) => {
  requireRole(session, "admin", "superadmin");
  const cantinaId = session.user.cantinaId!;
  const { searchParams } = new URL(req.url);
  const tipo = searchParams.get("tipo") ?? "productos";
  const dias = Math.min(Math.max(parseInt(searchParams.get("dias") ?? "30") || 30, 1), 365);
  const desde = new Date(Date.now() - dias * 86_400_000);

  if (tipo === "productos") {
    const detalles = await db.detalleVenta.findMany({
      where: { venta: { cantinaId, deletedAt: null, createdAt: { gte: desde } } },
      select: {
        productoId: true, cantidad: true, precioUsdUnitario: true,
        producto: { select: { nombre: true, categoria: true } },
      },
    });

    const map = new Map<string, {
      nombre: string; categoria: string; volumen: number; ingresos: number;
    }>();
    for (const d of detalles) {
      const nombre = d.producto?.nombre ?? "?";
      const categoria = d.producto?.categoria ?? "tienda";
      const prev = map.get(d.productoId) ?? { nombre, categoria, volumen: 0, ingresos: 0 };
      map.set(d.productoId, {
        nombre, categoria,
        volumen: prev.volumen + d.cantidad,
        ingresos: prev.ingresos + d.cantidad * d.precioUsdUnitario.toNumber(),
      });
    }
    const items = Array.from(map.values())
      .map(v => ({ ...v, ingresos: Math.round(v.ingresos * 100) / 100 }))
      .sort((a, b) => b.volumen - a.volumen)
      .slice(0, 20);

    return NextResponse.json({ items });
  }

  if (tipo === "cursos") {
    const ventas = await db.venta.findMany({
      where: { cantinaId, deletedAt: null, createdAt: { gte: desde }, alumnoId: { not: null } },
      select: { totalUsd: true, alumno: { select: { curso: true } } },
    });

    const map = new Map<string, { curso: string; totalUsd: number; count: number }>();
    for (const v of ventas) {
      const curso = v.alumno?.curso ?? "Desconocido";
      const prev = map.get(curso) ?? { curso, totalUsd: 0, count: 0 };
      map.set(curso, { curso, totalUsd: prev.totalUsd + v.totalUsd.toNumber(), count: prev.count + 1 });
    }
    const items = Array.from(map.values())
      .map(v => ({ ...v, totalUsd: Math.round(v.totalUsd * 100) / 100, promUsd: Math.round(v.totalUsd / Math.max(v.count, 1) * 100) / 100 }))
      .sort((a, b) => b.totalUsd - a.totalUsd);

    // Deuda por curso
    const deudas = await db.alumno.findMany({
      where: { cantinaId, activo: true, deletedAt: null },
      select: { curso: true, cuenta: { select: { saldo: true } } },
    });

    const deudaCurso = new Map<string, number>();
    for (const a of deudas) {
      const saldo = a.cuenta?.saldo.toNumber() ?? 0;
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
    const ventas = await db.venta.findMany({
      where: { cantinaId, createdAt: { gte: desde } },
      select: {
        vendedorId: true, totalUsd: true, esFiado: true, deletedAt: true,
        vendedor: { select: { nombre: true } },
      },
    });

    const map = new Map<string, {
      nombre: string; totalVentas: number; montoUsd: number;
      fiadoUsd: number; anulaciones: number;
    }>();
    for (const v of ventas) {
      const nombre = v.vendedor?.nombre ?? "?";
      const prev = map.get(v.vendedorId) ?? { nombre, totalVentas: 0, montoUsd: 0, fiadoUsd: 0, anulaciones: 0 };
      if (v.deletedAt) {
        map.set(v.vendedorId, { ...prev, anulaciones: prev.anulaciones + 1 });
      } else {
        map.set(v.vendedorId, {
          ...prev,
          totalVentas: prev.totalVentas + 1,
          montoUsd: prev.montoUsd + v.totalUsd.toNumber(),
          fiadoUsd: prev.fiadoUsd + (v.esFiado ? v.totalUsd.toNumber() : 0),
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
