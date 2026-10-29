import type { ViajePagoTransportistaFiltro } from "@/lib/viajesFiltroPagoTransportista";

/**
 * Filtros y orden de la grilla de Viajes que sobreviven a recargar la página (F5).
 * Se guardan en `sessionStorage`: duran mientras la pestaña esté abierta, así que al
 * volver otro día la grilla arranca limpia. Una clave por empresa (los filtros guardan
 * ids de clientes/transportistas/choferes, que no sirven en otra empresa).
 */

export type ViajesFiltrosAplicados = {
  numero: string;
  ctg: string;
  idPropio2: string;
  observaciones: string;
  clienteId: string;
  transportistaId: string;
  choferId: string;
  estado: string;
  facturacionEstado: string;
  liquidacionEstado: string;
  pagoTransportista: ViajePagoTransportistaFiltro;
  tipoFecha: "" | "carga" | "descarga";
  fechaDesde: string;
  fechaHasta: string;
  tipoUbicacion: "" | "origen" | "destino";
  ubicacion: string;
  periodo: "todos" | "desde_hoy" | "anteriores";
};

export const VIAJES_FILTROS_VACIOS: ViajesFiltrosAplicados = {
  numero: "",
  ctg: "",
  idPropio2: "",
  observaciones: "",
  clienteId: "",
  transportistaId: "",
  choferId: "",
  estado: "",
  facturacionEstado: "",
  liquidacionEstado: "",
  pagoTransportista: "",
  tipoFecha: "",
  fechaDesde: "",
  fechaHasta: "",
  tipoUbicacion: "",
  ubicacion: "",
  periodo: "todos",
};

export type ViajesListadoGuardado = {
  filtros: ViajesFiltrosAplicados;
  /** País del filtro Origen/Destino (código, ej. "AR"). */
  paisUbicacion: string;
  /** Sin validar: pasar por `parseViajeSortField`. */
  sortBy: string;
  sortDir: "asc" | "desc";
  pageSize: number;
};

export function claveListadoViajes(empresa: string): string {
  return `vialto:viajes-listado:${empresa}`;
}

function texto(v: unknown, fallback: string): string {
  return typeof v === "string" ? v : fallback;
}

/** Lo guardado para la empresa, o null si no hay nada (o no se puede leer). */
export function leerListadoViajes(clave: string): ViajesListadoGuardado | null {
  try {
    const raw = sessionStorage.getItem(clave);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<ViajesListadoGuardado> | null;
    if (!data || typeof data !== "object") return null;
    const f = (data.filtros ?? {}) as Partial<Record<keyof ViajesFiltrosAplicados, unknown>>;
    const filtros = { ...VIAJES_FILTROS_VACIOS };
    for (const k of Object.keys(VIAJES_FILTROS_VACIOS) as (keyof ViajesFiltrosAplicados)[]) {
      (filtros as Record<string, string>)[k] = texto(f[k], VIAJES_FILTROS_VACIOS[k]);
    }
    return {
      filtros,
      paisUbicacion: texto(data.paisUbicacion, "AR"),
      sortBy: texto(data.sortBy, ""),
      sortDir: data.sortDir === "asc" ? "asc" : "desc",
      pageSize:
        typeof data.pageSize === "number" && data.pageSize > 0 ? data.pageSize : 10,
    };
  } catch {
    return null;
  }
}

export function guardarListadoViajes(clave: string, data: ViajesListadoGuardado): void {
  try {
    sessionStorage.setItem(clave, JSON.stringify(data));
  } catch {
    // best-effort: sin storage (modo privado, bloqueado) la grilla funciona igual
  }
}
