import type { TipoIntervencionMantenimiento } from "@/types/api";

export type CategoriaIntervencion =
  | "motor"
  | "frenos"
  | "tren_motriz"
  | "electrico"
  | "carga_acople"
  | "neumaticos";

const CATEGORIA_INTERVENCION_LABELS: Record<CategoriaIntervencion, string> = {
  motor: "Motor y sistema de propulsión",
  frenos: "Sistema de frenos",
  tren_motriz: "Tren motriz, suspensión y dirección",
  electrico: "Sistema eléctrico y electrónico",
  carga_acople: "Sistema de carga y acople",
  neumaticos: "Neumáticos",
};

/**
 * Catálogo de tipos de intervención, agrupado por sistema del vehículo.
 * `categoria: null` = "Otro" (catch-all sin categoría, exige descripción — ver
 * `assertDescripcionSiTipoOtro` en el backend).
 */
const TIPO_INTERVENCION_CATALOGO: {
  value: TipoIntervencionMantenimiento;
  label: string;
  categoria: CategoriaIntervencion | null;
}[] = [
  // Motor y sistema de propulsión
  { value: "cambio_aceite_motor", label: "Cambio de aceite de motor", categoria: "motor" },
  { value: "revision_filtros", label: "Revisión de filtros", categoria: "motor" },
  { value: "inspeccion_bandas_correas", label: "Inspección de bandas y correas", categoria: "motor" },
  { value: "calibracion_valvulas", label: "Calibración de válvulas", categoria: "motor" },
  { value: "revision_inyectores", label: "Revisión de inyectores", categoria: "motor" },
  { value: "inspeccion_turbocompresor", label: "Inspección del turbocompresor", categoria: "motor" },
  // Sistema de frenos
  { value: "revision_balatas_pastillas", label: "Revisión de balatas y pastillas", categoria: "frenos" },
  { value: "rectificacion_tambores_discos", label: "Rectificación de tambores y discos", categoria: "frenos" },
  { value: "mantenimiento_sistema_aire", label: "Mantenimiento del sistema de aire", categoria: "frenos" },
  { value: "prueba_camaras_freno", label: "Prueba de cámaras de freno", categoria: "frenos" },
  { value: "ajuste_matracas", label: "Ajuste de matracas", categoria: "frenos" },
  // Tren motriz, suspensión y dirección
  { value: "servicio_transmision", label: "Servicio de transmisión", categoria: "tren_motriz" },
  { value: "servicio_diferencial", label: "Servicio de diferencial", categoria: "tren_motriz" },
  { value: "engrasado_chasis", label: "Engrasado de chasis", categoria: "tren_motriz" },
  { value: "alineacion_balanceo", label: "Alineación y balanceo", categoria: "tren_motriz" },
  { value: "revision_suspension", label: "Revisión de suspensión", categoria: "tren_motriz" },
  { value: "inspeccion_rodamientos", label: "Inspección de rodamientos", categoria: "tren_motriz" },
  // Sistema eléctrico y electrónico
  { value: "diagnostico_escaner", label: "Diagnóstico por escáner", categoria: "electrico" },
  { value: "prueba_baterias", label: "Prueba de baterías", categoria: "electrico" },
  { value: "control_alternador", label: "Control del alternador", categoria: "electrico" },
  { value: "inspeccion_luces", label: "Inspección de luces", categoria: "electrico" },
  // Sistema de carga y acople
  { value: "mantenimiento_quinta_rueda", label: "Mantenimiento de quinta rueda", categoria: "carga_acople" },
  { value: "revision_perno_rey", label: "Revisión de perno rey", categoria: "carga_acople" },
  { value: "inspeccion_lineas_acople", label: "Inspección de líneas de acople", categoria: "carga_acople" },
  // Neumáticos
  { value: "rotacion_cubiertas", label: "Rotación de cubiertas", categoria: "neumaticos" },
  { value: "cambio_cubiertas", label: "Cambio de cubiertas", categoria: "neumaticos" },
  { value: "reparacion_pinchadura", label: "Reparación de pinchadura", categoria: "neumaticos" },
  // Catch-all
  { value: "otro", label: "Otro", categoria: null },
];

export const TIPO_INTERVENCION_LABELS: Record<TipoIntervencionMantenimiento, string> =
  Object.fromEntries(
    TIPO_INTERVENCION_CATALOGO.map((t) => [t.value, t.label]),
  ) as Record<TipoIntervencionMantenimiento, string>;

/** Opciones agrupadas por categoría, para renderizar checkboxes con subtítulo. No incluye "Otro". */
export const TIPO_INTERVENCION_CATEGORIAS: {
  id: CategoriaIntervencion;
  label: string;
  opciones: [TipoIntervencionMantenimiento, string][];
}[] = (Object.keys(CATEGORIA_INTERVENCION_LABELS) as CategoriaIntervencion[]).map(
  (id) => ({
    id,
    label: CATEGORIA_INTERVENCION_LABELS[id],
    opciones: TIPO_INTERVENCION_CATALOGO.filter((t) => t.categoria === id).map(
      (t) => [t.value, t.label] as [TipoIntervencionMantenimiento, string],
    ),
  }),
);

/** "Otro" — catch-all sin categoría, se renderiza aparte del resto. */
export const TIPO_INTERVENCION_OTRO: [TipoIntervencionMantenimiento, string] = [
  "otro",
  "Otro",
];

export function fmtTipoIntervencion(tipo: string): string {
  return (
    TIPO_INTERVENCION_LABELS[tipo as TipoIntervencionMantenimiento] ?? tipo
  );
}

export function fmtTiposIntervencion(tipos: string[]): string {
  return tipos.length > 0 ? tipos.map(fmtTipoIntervencion).join(", ") : "—";
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
 * Márgenes de anticipación para marcar una intervención "próxima a vencer",
 * uno por criterio (km o fecha) — corren en paralelo, ver
 * `calcularAlertasMantenimiento`. Heurísticas provisorias de demo — el margen
 * real es una pregunta abierta del documento funcional (sección 8).
 */
export const ALERTA_MARGEN_KM = 1000;
export const ALERTA_MARGEN_DIAS = 15;

export type AlertaSeveridad = "vencido" | "proximo";

/**
 * Una alerta cubre un solo criterio (km o fecha) para un (vehículo, tipo) —
 * ejes independientes, igual que el resto de los indicadores aditivos del
 * sistema (nunca se combinan en una sola alerta "peor de los dos").
 */
export type AlertaMantenimiento =
  | {
      criterio: "km";
      vehiculoId: string;
      tipo: TipoIntervencionMantenimiento;
      proximoKm: number;
      kmActual: number;
      faltanKm: number;
      severidad: AlertaSeveridad;
      ultimaFecha: string;
    }
  | {
      criterio: "fecha";
      vehiculoId: string;
      tipo: TipoIntervencionMantenimiento;
      proximaFecha: string;
      faltanDias: number;
      severidad: AlertaSeveridad;
      ultimaFecha: string;
    };
