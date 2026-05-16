"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

// ── Helpers ────────────────────────────────────────────────────────────────────

function pdfBase(titulo: string, subtitulo: string): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  doc.setFontSize(16);
  doc.setTextColor(30, 30, 30);
  doc.text("CantinApp — " + titulo, 14, 18);

  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(subtitulo, 14, 25);
  doc.text(
    new Date().toLocaleDateString("es-VE", { day: "2-digit", month: "long", year: "numeric" }),
    196,
    25,
    { align: "right" },
  );

  return doc;
}

function xlsxDownload(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename);
}

// ── Productos ──────────────────────────────────────────────────────────────────

interface Producto {
  nombre: string;
  categoria: string;
  cantidadVendida: number;
  ingresoUsd: number;
}

export function exportProductosPdf(data: Producto[], diasLabel: string) {
  const doc = pdfBase("Reporte de Productos", `Ranking de productos — ${diasLabel}`);

  autoTable(doc, {
    startY: 32,
    head: [["#", "Producto", "Categoría", "Unidades vendidas", "Ingreso USD"]],
    body: data.map((p, i) => [
      i + 1,
      p.nombre,
      p.categoria === "menu" ? "Menú" : "Tienda",
      p.cantidadVendida,
      `$${p.ingresoUsd.toFixed(2)}`,
    ]),
    headStyles: { fillColor: [59, 130, 246], fontSize: 9 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      3: { halign: "right" },
      4: { halign: "right" },
    },
  });

  doc.save(`cantinapp_productos_${diasLabel.replace(/ /g, "_")}.pdf`);
}

export function exportProductosExcel(data: Producto[], diasLabel: string) {
  const rows = data.map((p, i) => ({
    "#": i + 1,
    Producto: p.nombre,
    Categoría: p.categoria === "menu" ? "Menú" : "Tienda",
    "Unidades vendidas": p.cantidadVendida,
    "Ingreso USD": p.ingresoUsd,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{ wch: 4 }, { wch: 30 }, { wch: 12 }, { wch: 18 }, { wch: 14 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Productos");
  xlsxDownload(wb, `cantinapp_productos_${diasLabel.replace(/ /g, "_")}.xlsx`);
}

// ── Vendedores ─────────────────────────────────────────────────────────────────

interface Vendedor {
  nombre: string;
  ventas: number;
  totalUsd: number;
  fiados: number;
  anulaciones: number;
}

export function exportVendedoresPdf(data: Vendedor[], diasLabel: string) {
  const doc = pdfBase("Reporte de Vendedores", `Rendimiento por vendedor — ${diasLabel}`);

  autoTable(doc, {
    startY: 32,
    head: [["Vendedor", "Ventas", "Total USD", "Fiados", "Anulaciones"]],
    body: data.map(v => [
      v.nombre,
      v.ventas,
      `$${v.totalUsd.toFixed(2)}`,
      v.fiados,
      v.anulaciones,
    ]),
    headStyles: { fillColor: [16, 185, 129], fontSize: 9 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
    },
  });

  doc.save(`cantinapp_vendedores_${diasLabel.replace(/ /g, "_")}.pdf`);
}

export function exportVendedoresExcel(data: Vendedor[], diasLabel: string) {
  const rows = data.map(v => ({
    Vendedor: v.nombre,
    Ventas: v.ventas,
    "Total USD": v.totalUsd,
    Fiados: v.fiados,
    Anulaciones: v.anulaciones,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{ wch: 28 }, { wch: 8 }, { wch: 12 }, { wch: 8 }, { wch: 12 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Vendedores");
  xlsxDownload(wb, `cantinapp_vendedores_${diasLabel.replace(/ /g, "_")}.xlsx`);
}

// ── Deudas ─────────────────────────────────────────────────────────────────────

interface DeudorRow {
  nombre: string;
  curso: string;
  saldo: number;
  ultimaVentaFecha: string | null;
  diasDeuda: number;
}

export function exportDeudasPdf(deudores: DeudorRow[]) {
  const total = deudores.reduce((s, d) => s + Math.abs(d.saldo), 0);
  const doc = pdfBase(
    "Reporte de Deudas",
    `${deudores.length} deudores · Total: $${total.toFixed(2)}`,
  );

  autoTable(doc, {
    startY: 32,
    head: [["Alumno", "Curso", "Saldo USD", "Última compra", "Días"]],
    body: deudores.map(d => [
      d.nombre,
      d.curso,
      `$${Math.abs(d.saldo).toFixed(2)}`,
      d.ultimaVentaFecha
        ? new Date(d.ultimaVentaFecha).toLocaleDateString("es-VE")
        : "—",
      d.diasDeuda >= 999 ? "+90" : String(d.diasDeuda),
    ]),
    headStyles: { fillColor: [239, 68, 68], fontSize: 9 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      2: { halign: "right", textColor: [200, 30, 30] },
      3: { halign: "center" },
      4: { halign: "right" },
    },
  });

  doc.save("cantinapp_deudas.pdf");
}

export function exportDeudasExcel(deudores: DeudorRow[]) {
  const rows = deudores.map(d => ({
    Alumno: d.nombre,
    Curso: d.curso,
    "Saldo USD": Math.abs(d.saldo),
    "Última compra": d.ultimaVentaFecha
      ? new Date(d.ultimaVentaFecha).toLocaleDateString("es-VE")
      : "",
    "Días de deuda": d.diasDeuda >= 999 ? 90 : d.diasDeuda,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{ wch: 30 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 14 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Deudas");
  xlsxDownload(wb, "cantinapp_deudas.xlsx");
}

// ── CRM: Deudores (con marca de agua Confidencial) ────────────────────────────

interface DeudorCrm {
  nombre: string; curso: string; seccion: string | null;
  saldo: number; diasSinComprar: number; segmento: string;
}

export function exportDeudoresCrmPdf(deudores: DeudorCrm[]) {
  const total = deudores.reduce((s, d) => s + Math.abs(d.saldo), 0);
  const doc = pdfBase("Reporte de Deudores CRM", `${deudores.length} alumnos · Deuda total: $${total.toFixed(2)} USD`);

  // Marca de agua
  doc.setFontSize(52);
  doc.setTextColor(220, 220, 220);
  doc.saveGraphicsState();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (doc as any).setGState((doc as any).GState({ opacity: 0.15 }));
  doc.text("CONFIDENCIAL", 105, 155, { align: "center", angle: 45 });
  doc.restoreGraphicsState();
  doc.setTextColor(30, 30, 30);

  autoTable(doc, {
    startY: 32,
    head: [["Alumno", "Curso", "Sección", "Deuda USD", "Días sin comprar", "Segmento"]],
    body: deudores.map(d => [
      d.nombre,
      d.curso,
      d.seccion ?? "—",
      `$${Math.abs(d.saldo).toFixed(2)}`,
      d.diasSinComprar >= 999 ? "+90" : `${d.diasSinComprar}d`,
      d.segmento.replace(/_/g, " "),
    ]),
    headStyles: { fillColor: [239, 68, 68], fontSize: 9 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [255, 245, 245] },
    columnStyles: {
      3: { halign: "right", textColor: [180, 20, 20] },
      4: { halign: "right" },
    },
  });

  doc.save(`cantinapp_crm_deudores_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportDeudoresCrmExcel(deudores: DeudorCrm[]) {
  const rows = deudores.map(d => ({
    Alumno: d.nombre,
    Curso: d.curso,
    Sección: d.seccion ?? "",
    "Deuda USD": Math.abs(d.saldo),
    "Días sin comprar": d.diasSinComprar >= 999 ? 90 : d.diasSinComprar,
    Segmento: d.segmento.replace(/_/g, " "),
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{ wch: 30 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 18 }, { wch: 20 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Deudores CRM");
  xlsxDownload(wb, `cantinapp_crm_deudores_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ── CRM: Estado de cuenta individual ─────────────────────────────────────────

interface EstadoCuentaItem {
  fecha: string; descripcion: string; montoUsd: number; tipo: "compra" | "abono";
}

export function exportEstadoCuentaPdf(
  alumno: { nombre: string; curso: string; saldo: number },
  items: EstadoCuentaItem[],
  mes: string,
) {
  const doc = pdfBase(
    "Estado de Cuenta",
    `${alumno.nombre} · ${alumno.curso} · ${mes}`,
  );

  autoTable(doc, {
    startY: 32,
    head: [["Fecha", "Descripción", "Compra USD", "Abono USD", "Saldo"]],
    body: (() => {
      let saldo = 0;
      return items.map(it => {
        if (it.tipo === "abono") saldo += it.montoUsd;
        else saldo -= it.montoUsd;
        return [
          new Date(it.fecha).toLocaleDateString("es-VE"),
          it.descripcion,
          it.tipo === "compra" ? `$${it.montoUsd.toFixed(2)}` : "",
          it.tipo === "abono"  ? `$${it.montoUsd.toFixed(2)}` : "",
          `$${saldo.toFixed(2)}`,
        ];
      });
    })(),
    headStyles: { fillColor: [59, 130, 246], fontSize: 9 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" },
    },
  });

  // Saldo final
  const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? 200;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`Saldo al cierre: $${alumno.saldo.toFixed(2)} USD`, 14, finalY + 8);

  doc.save(`cantinapp_estado_cuenta_${alumno.nombre.replace(/ /g, "_")}_${mes}.pdf`);
}

// ── CRM: Clientes frecuentes ──────────────────────────────────────────────────

interface ClienteFrecuente {
  nombre: string; curso: string; totalVentas: number;
  gastoTotalUsd: number; diasSinComprar: number;
}

export function exportClientesFrecuentesPdf(clientes: ClienteFrecuente[], dias: number) {
  const doc = pdfBase(
    "Clientes Frecuentes",
    `Top compradores en los últimos ${dias} días`,
  );

  autoTable(doc, {
    startY: 32,
    head: [["Alumno", "Curso", "Compras", "Gasto total USD", "Días sin comprar"]],
    body: clientes.map(c => [
      c.nombre, c.curso, c.totalVentas,
      `$${c.gastoTotalUsd.toFixed(2)}`,
      c.diasSinComprar >= 999 ? "Nunca" : `${c.diasSinComprar}d`,
    ]),
    headStyles: { fillColor: [139, 92, 246], fontSize: 9 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
  });

  doc.save(`cantinapp_crm_frecuentes_${dias}d.pdf`);
}

export function exportClientesFrecuentesExcel(clientes: ClienteFrecuente[], dias: number) {
  const rows = clientes.map(c => ({
    Alumno: c.nombre, Curso: c.curso, Compras: c.totalVentas,
    "Gasto total USD": c.gastoTotalUsd,
    "Días sin comprar": c.diasSinComprar >= 999 ? 90 : c.diasSinComprar,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{ wch: 30 }, { wch: 12 }, { wch: 10 }, { wch: 16 }, { wch: 18 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Clientes frecuentes");
  xlsxDownload(wb, `cantinapp_crm_frecuentes_${dias}d.xlsx`);
}
