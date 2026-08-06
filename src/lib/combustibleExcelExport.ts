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
 * Columnas de la exportación de cargas de combustible.
 * Fuente única compartida por Excel y CSV, para que el contenido sea idéntico.
 * Replica el formato del archivo de ejemplo:
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
    // El guion bajo se reemplaza por espacio para valores compuestos (ej.
    // "cuenta_corriente" -> "CUENTA CORRIENTE").
    {
      id: "pago",
      label: "PAGO",
      getValue: (c) => upper(c.formaPago).replace(/_/g, " "),
    },
  ];
}

/** yyyy-mm-dd (UTC) de una fecha ISO. */
function isoDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

/**
 * Período para el nombre del archivo. Si se pasa el rango de fechas (desde/hasta)
 * del filtro, se usa tal cual (ej. `2026-07-01-2026-07-17`). Si no, se deriva el
 * rango de fechas de las cargas exportadas.
 * Compartido por Excel y CSV para que ambos usen el mismo nombre de período.
 */
export function periodoArchivoCargas(
  cargas: CargaCombustible[],
  rango?: { from?: string; to?: string },
): string {
  if (rango?.from && rango?.to) {
    return rango.from === rango.to ? rango.from : `${rango.from}-${rango.to}`;
  }
  if (rango?.from) return `desde-${rango.from}`;
  if (rango?.to) return `hasta-${rango.to}`;
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
  opts?: { from?: string; to?: string },
): Promise<void> {
  const periodo = periodoArchivoCargas(cargas, opts);
  await generarExcel(
    cargaCombustibleColumnas(),
    cargas,
    `cargas-combustible-${periodo}`,
  );
}
