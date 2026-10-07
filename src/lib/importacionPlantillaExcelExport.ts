import * as XLSX from "xlsx";
import type { ImportColumnasEsperadasModulo } from "@/types/api";

/**
 * Genera y descarga un Excel en blanco (una hoja por módulo, solo la fila de
 * encabezados — sin datos de ejemplo) con las columnas que el importador
 * espera hoy para ese tenant.
 */
export function descargarPlantillaImportacion(
  modulos: ImportColumnasEsperadasModulo[],
  filename = "plantilla_importacion",
) {
  const workbook = XLSX.utils.book_new();
  // Viajes va primera: es la hoja que más se completa. El orden de las hojas
  // no afecta al import (se detectan por nombre/encabezados y se importan en
  // orden de dependencia igual).
  const ordenados = [
    ...modulos.filter((m) => m.modulo === "viajes"),
    ...modulos.filter((m) => m.modulo !== "viajes"),
  ];
  for (const m of ordenados) {
    if (m.columnas.length === 0) continue;
    const headers = m.columnas.map((c) => c.excelHeader);
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    ws["!cols"] = headers.map((h) => ({ wch: Math.max(14, h.length + 2) }));
    // Los nombres de hoja de Excel no pueden superar 31 caracteres.
    XLSX.utils.book_append_sheet(workbook, ws, m.sheet.slice(0, 31));
  }
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}
