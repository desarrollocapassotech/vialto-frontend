import type { TipoIntervencionMantenimiento } from "@/types/api";

export const TIPO_INTERVENCION_LABELS: Record<
  TipoIntervencionMantenimiento,
  string
> = {
  service: "Service",
  aceite: "Cambio de aceite",
  filtro: "Cambio de filtro",
  cubiertas: "Cubiertas",
  otro: "Otro",
};

export const TIPO_INTERVENCION_OPTIONS = Object.entries(
  TIPO_INTERVENCION_LABELS,
) as [TipoIntervencionMantenimiento, string][];

export function fmtTipoIntervencion(tipo: string): string {
  return (
    TIPO_INTERVENCION_LABELS[tipo as TipoIntervencionMantenimiento] ?? tipo
  );
}

export function fmtFechaIntervencion(iso: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}

export function fmtKm(km: number | null | undefined): string {
  if (km === null || km === undefined) return "—";
  return `${km.toLocaleString("es-AR")} km`;
}

/**
 * Margen de anticipación para marcar una intervención "próxima a vencer" por km.
 * Heurística provisoria de demo — el margen real y si también debe correr por
 * fecha son preguntas abiertas del documento funcional (sección 8).
 */
export const ALERTA_MARGEN_KM = 1000;

export type AlertaSeveridad = "vencido" | "proximo";

export interface AlertaMantenimiento {
  vehiculoId: string;
  tipo: TipoIntervencionMantenimiento;
  proximoKm: number;
  kmActual: number;
  faltanKm: number;
  severidad: AlertaSeveridad;
  ultimaFecha: string;
}
