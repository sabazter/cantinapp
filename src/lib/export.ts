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
