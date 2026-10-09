import type {
  EstadoOrden,
  EstadoVencimiento,
  FilaVencimiento,
  FuenteKm,
  TareaMantenimiento,
  TipoOrden,
} from "@/types/mantenimiento";
import { formatCurrencyArFromNumber } from "@/lib/currencyMask";

// ── Catálogo de tareas ───────────────────────────────────────────────────────
// Duplicado a propósito del backend (vialto-backend/src/modules/mantenimiento/
// tareas-mantenimiento.const.ts): no hay paquete compartido. Mantener sincronizados.

export type CategoriaTarea =
  | "motor"
  | "frenos"
  | "tren_motriz"
  | "electrico"
  | "carga_acople"
  | "neumaticos";

const CATEGORIA_TAREA_LABELS: Record<CategoriaTarea, string> = {
  motor: "Motor y sistema de propulsión",
  frenos: "Sistema de frenos",
  tren_motriz: "Tren motriz, suspensión y dirección",
  electrico: "Sistema eléctrico y electrónico",
  carga_acople: "Sistema de carga y acople",
  neumaticos: "Neumáticos",
};

const TAREAS_CATALOGO: {
  value: TareaMantenimiento;
  label: string;
  categoria: CategoriaTarea | null;
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

export const TAREA_LABELS: Record<TareaMantenimiento, string> = Object.fromEntries(
  TAREAS_CATALOGO.map((t) => [t.value, t.label]),
) as Record<TareaMantenimiento, string>;

/** Opciones agrupadas por categoría, para checkboxes con subtítulo. No incluye "Otro". */
export const TAREAS_POR_CATEGORIA: {
  id: CategoriaTarea;
  label: string;
  opciones: [TareaMantenimiento, string][];
}[] = (Object.keys(CATEGORIA_TAREA_LABELS) as CategoriaTarea[]).map((id) => ({
  id,
  label: CATEGORIA_TAREA_LABELS[id],
  opciones: TAREAS_CATALOGO.filter((t) => t.categoria === id).map(
    (t) => [t.value, t.label] as [TareaMantenimiento, string],
  ),
}));

/** "Otro" — catch-all sin categoría, se renderiza aparte del resto. */
export const TAREA_OTRO: [TareaMantenimiento, string] = ["otro", "Otro"];

export function fmtTarea(tarea: string): string {
  return TAREA_LABELS[tarea as TareaMantenimiento] ?? tarea;
}

export function fmtTareas(tareas: string[]): string {
  return tareas.length > 0 ? tareas.map(fmtTarea).join(", ") : "—";
}

// ── Formatos generales ───────────────────────────────────────────────────────

/** Fecha sin hora: siempre en UTC (ver "Fechas sin hora" en CLAUDE.md del front). */
export function fmtFecha(iso: string | null | undefined): string {
  if (!iso) return "—";
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

export function fmtMoneda(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `$ ${formatCurrencyArFromNumber(n) || "0"}`;
}

const plural = (n: number, uno: string, varios: string) => `${n.toLocaleString("es-AR")} ${n === 1 ? uno : varios}`;

// ── Semáforo de vencimientos ─────────────────────────────────────────────────

/** Labels en MAYÚSCULA y colores del badge (mismo criterio que el resto de los badges de estado). */
export const ESTADO_VENCIMIENTO: Record<EstadoVencimiento, { label: string; badge: string; contador: string }> = {
  vencido: { label: "VENCIDO", badge: "bg-red-50 text-red-700 border-red-200", contador: "Vencidos" },
  proximo: { label: "PRÓXIMO", badge: "bg-amber-50 text-amber-800 border-amber-200", contador: "Próximos" },
  sin_datos: { label: "SIN DATOS", badge: "bg-gray-100 text-gray-600 border-gray-300/80", contador: "Sin datos" },
  ok: { label: "AL DÍA", badge: "bg-emerald-50 text-emerald-700 border-emerald-200", contador: "Al día" },
};

export const ESTADOS_VENCIMIENTO_ORDEN: EstadoVencimiento[] = ["vencido", "proximo", "sin_datos", "ok"];

export const CATEGORIA_PLAN_LABELS: Record<string, string> = {
  mecanico: "Mecánico",
  documental: "Documental",
};

/** "Faltan 1.500 km · 12 días", "Pasado por 1.000 km", "Venció hace 5 días", etc. */
export function fmtFaltan(f: FilaVencimiento): string {
  if (f.estado === "sin_datos") {
    return f.referencia ? "Falta el km actual" : "Falta el último service";
  }
  const partes: string[] = [];
  if (f.kmRestantes !== null) {
    partes.push(
      f.kmRestantes > 0
        ? `Faltan ${plural(f.kmRestantes, "km", "km")}`
        : f.kmRestantes === 0
          ? "Llegó al km"
          : `Pasado por ${plural(-f.kmRestantes, "km", "km")}`,
    );
  }
  if (f.diasRestantes !== null) {
    partes.push(
      f.diasRestantes > 0
        ? `${partes.length ? "" : "Faltan "}${plural(f.diasRestantes, "día", "días")}`
        : f.diasRestantes === 0
          ? "Vence hoy"
          : `Venció hace ${plural(-f.diasRestantes, "día", "días")}`,
    );
  }
  return partes.join(" · ") || "—";
}

const FUENTE_KM_LABELS: Record<string, string> = {
  carga: "Carga de combustible",
  edicion: "Corrección manual",
  orden_trabajo: "Orden de trabajo",
};

/** De dónde sale el km: "Carga de combustible del 12/09/2026", "Km cargado en el vehículo", etc. */
export function fmtOrigenKm(odometro: { fecha: string; fuente: FuenteKm } | null): string {
  if (!odometro) return "Sin lecturas";
  if (odometro.fuente === "vehiculo") return "Km cargado en el vehículo";
  return `${FUENTE_KM_LABELS[odometro.fuente] ?? odometro.fuente} del ${fmtFecha(odometro.fecha)}`;
}

/** Desde dónde se cuenta el ciclo actual. */
export function fmtReferencia(f: FilaVencimiento): string {
  const r = f.referencia;
  if (!r) return "Sin último service";
  const datos = [r.fecha ? fmtFecha(r.fecha) : null, r.km !== null ? fmtKm(r.km) : null].filter(Boolean).join(" · ");
  if (r.tipo === "orden") return `OT N° ${r.ordenNumero ?? "—"}${datos ? ` · ${datos}` : ""}`;
  return `Cargado al asignar${datos ? ` · ${datos}` : ""}`;
}

// ── Órdenes de trabajo ───────────────────────────────────────────────────────

export const TIPO_ORDEN_LABELS: Record<TipoOrden, string> = {
  preventivo: "Preventivo",
  correctivo: "Correctivo",
};

export function fmtTipoOrden(tipo: string): string {
  return TIPO_ORDEN_LABELS[tipo as TipoOrden] ?? tipo;
}

/** Badge de estado de una OT: ANULADA va gris y tachada, igual que en Facturas/Liquidaciones. */
export const ESTADO_ORDEN: Record<EstadoOrden, { label: string; badge: string }> = {
  cerrada: { label: "REGISTRADA", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  anulada: { label: "ANULADA", badge: "bg-gray-100 text-gray-500 border-gray-300/80 line-through" },
  abierta: { label: "ABIERTA", badge: "bg-amber-50 text-amber-800 border-amber-200" },
  en_curso: { label: "EN CURSO", badge: "bg-amber-50 text-amber-800 border-amber-200" },
};

/** Nombre legible de un adjunto a partir de su URL de Cloudinary (sin el prefijo de timestamp). */
export function nombreAdjunto(url: string): string {
  const ultimo = decodeURIComponent(url.split("/").pop() ?? "archivo");
  return ultimo.replace(/^\d{10,}-/, "");
}
