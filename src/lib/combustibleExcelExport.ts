import type { CargaCombustible } from "@/types/api";
import { generarExcel, type ExcelColDef } from "./stockExcelExport";

/** Fecha en formato DD/MM/YYYY (UTC), igual que el listado de combustible. */
function fmtFechaExcel(iso: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}

function upper(v: string | null | undefined): string {
  return (v ?? "").toUpperCase();
}

/**
 * Columnas del Excel de cargas de combustible.
 * Replica exactamente el formato del archivo de ejemplo:
 * DOMINIO | FECHA | LITROS | MONTO | KILOMETROS | LUGAR (NOMBRE) | CHOFER | PAGO
 */
export function cargaCombustibleColumnas(): ExcelColDef<CargaCombustible>[] {
  return [
    {
      id: "dominio",
      label: "DOMINIO",
      getValue: (c) => upper(c.vehiculo?.patente ?? c.vehiculoId),
      required: true,
    },
    {
      id: "fecha",
      label: "FECHA",
      getValue: (c) => fmtFechaExcel(c.fecha),
      required: true,
    },
    {
      id: "litros",
      label: "LITROS",
      getValue: (c) => c.litros,
      required: true,
    },
    { id: "monto", label: "MONTO", getValue: (c) => c.importe, required: true },
    {
      id: "kilometros",
      label: "KILOMETROS",
      getValue: (c) => c.km,
      required: true,
    },
    {
      id: "lugar",
      label: "LUGAR (NOMBRE)",
      getValue: (c) => upper(c.estacion),
      required: true,
    },
    {
      id: "chofer",
      label: "CHOFER",
      getValue: (c) => upper(c.chofer?.nombre),
      required: true,
    },
    // En el ejemplo PAGO aparece como valor crudo en mayúsculas (ej. "TARJETA"),
    // que no está mapeado en FORMA_PAGO_LABELS, por eso no aplico el label.
    { id: "pago", label: "PAGO", getValue: (c) => upper(c.formaPago) },
  ];
}

/** yyyy-mm-dd (UTC) de una fecha ISO. */
function isoDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

/**
 * Período para el nombre del archivo. Si se pasa un mes (YYYY-MM) del filtro,
 * se usa tal cual (ej. `2026-06`). Si no, se deriva el rango de fechas de las
 * cargas exportadas (ej. `2026-05-06-2026-07-31`).
 */
function periodoArchivo(cargas: CargaCombustible[], month?: string): string {
  if (month) return month;
  if (cargas.length === 0) return "sin-datos";
  const fechas = cargas.map((c) => isoDate(c.fecha)).sort();
  const min = fechas[0];
  const max = fechas[fechas.length - 1];
  return min === max ? min : `${min}-${max}`;
}

/**
 * Genera y descarga el Excel de cargas de combustible en el navegador.
 * El nombre incluye el período: `cargas-combustible-<periodo>.xlsx`.
 */
export async function exportarCargasCombustible(
  cargas: CargaCombustible[],
  opts?: { month?: string },
): Promise<void> {
  const periodo = periodoArchivo(cargas, opts?.month);
  await generarExcel(
    cargaCombustibleColumnas(),
    cargas,
    `cargas-combustible-${periodo}`,
  );
}
