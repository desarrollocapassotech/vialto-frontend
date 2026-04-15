import { viajeTieneFacturaAsignada } from './viajesFlota';

/** Orden usado en selects de edición / listado. */
export const VIAJE_ESTADOS_TODOS = [
  'pendiente',
  'en_curso',
  'finalizado_sin_facturar',
  'facturado_sin_cobrar',
  'cobrado',
  'cancelado',
] as const;

/** Solo estados permitidos al crear un viaje (no finales). */
export const VIAJE_ESTADOS_ALTA = ['pendiente', 'en_curso', 'cancelado'] as const;

/**
 * Texto corto en badges y listas (mayúsculas, estilo UI).
 * Códigos legados de API/BD incluidos para que el lookup sea directo.
 */
export const estadoViajeLabel: Record<string, string> = {
  pendiente: 'PENDIENTE',
  en_curso: 'EN CURSO',
  /** Legado si la BD aún no migró */
  finalizado: 'FINALIZADO',
  finalizado_sin_facturar: 'FINALIZADO',
  /** Legado API/BD antes del rename */
  finalizado_facturado: 'FACTURADO',
  facturado_sin_cobrar: 'FACTURADO',
  /** Legado API/BD */
  finalizado_cobrado: 'COBRADO',
  cobrado: 'COBRADO',
  cancelado: 'CANCELADO',
};

/** Une alias legados al código canónico para textos de ayuda. */
export function normalizarClaveEstadoViaje(estado: string): string {
  const e = String(estado).trim().toLowerCase();
  if (e === 'finalizado') return 'finalizado_sin_facturar';
  if (e === 'finalizado_facturado') return 'facturado_sin_cobrar';
  if (e === 'finalizado_cobrado') return 'cobrado';
  return e;
}

/** Descripción para tooltip (una por estado canónico). */
const estadoViajeAyuda: Record<string, string> = {
  pendiente:
    'Viaje cargado en el sistema: la operación de transporte aún no comenzó.',
  en_curso:
    'El servicio está en curso: carga, tránsito o descarga según la etapa.',
  finalizado_sin_facturar:
    'La operación ya terminó; todavía no emitiste la factura al cliente por este viaje.',
  facturado_sin_cobrar:
    'Ya hay factura asociada; falta registrar el cobro o el cliente aún no pagó.',
  cobrado: 'Facturación y cobro de este viaje registrados.',
  cancelado: 'Viaje anulado o no realizado; no corresponde facturar.',
};

/** Texto de ayuda para mostrar en `title` / tooltip según el código de estado (incluye legados). */
export function tooltipEstadoViaje(estado: string): string {
  const k = normalizarClaveEstadoViaje(estado);
  return estadoViajeAyuda[k] ?? '';
}

/** Gris — pendiente (sin animación). */
const BADGE_PENDIENTE_GRIS =
  'bg-zinc-100 text-zinc-800 border-zinc-300/90';

/** Amarillo leve — finalizado sin facturar (titileo). */
const BADGE_AMARILLO_SIN_FACTURAR =
  'bg-amber-50 text-amber-950 border-amber-200/95 animate-estado-atencion motion-reduce:animate-none';

/** Amarillo más intenso — facturado sin cobrar (titileo). */
const BADGE_AMARILLO_FACTURADO_SIN_COBRAR =
  'bg-amber-200 text-amber-950 border-amber-400/90 animate-estado-atencion motion-reduce:animate-none';

/** Colores de badge en tablas (Tailwind). */
export const estadoViajeBadgeClass: Record<string, string> = {
  pendiente: BADGE_PENDIENTE_GRIS,
  en_curso:
    'bg-sky-100 text-sky-950 border-sky-400/70 animate-estado-atencion-suave motion-reduce:animate-none',
  finalizado: BADGE_AMARILLO_SIN_FACTURAR,
  finalizado_sin_facturar: BADGE_AMARILLO_SIN_FACTURAR,
  finalizado_facturado: BADGE_AMARILLO_FACTURADO_SIN_COBRAR,
  facturado_sin_cobrar: BADGE_AMARILLO_FACTURADO_SIN_COBRAR,
  finalizado_cobrado:
    'bg-emerald-100 text-emerald-950 border-emerald-500/80',
  cobrado:
    'bg-emerald-100 text-emerald-950 border-emerald-500/80',
  cancelado: 'bg-red-100 text-red-950 border-red-400/80',
};

export const estadoViajeBadgeClassDefault = 'bg-vialto-mist text-vialto-steel border-black/15';

/**
 * Estados en los que la UI muestra km recorridos y litros consumidos (campos opcionales).
 */
export function estadoMuestraKmLitros(estado: string): boolean {
  const e = String(estado).trim().toLowerCase();
  if (e === 'finalizado' || e === 'finalizado_sin_facturar') return true;
  if (e === 'finalizado_facturado' || e === 'facturado_sin_cobrar') return true;
  if (e === 'finalizado_cobrado' || e === 'cobrado') return true;
  return false;
}

/** Para decidir si mostrar el modal de km/litros (viaje sin ambos valores en API). */
export function viajeTieneKmYLitrosEnApi(v: {
  kmRecorridos: number | null;
  litrosConsumidos: number | null;
}): boolean {
  return v.kmRecorridos != null && v.litrosConsumidos != null;
}

export function draftKmLitrosVacios(km: string, litros: string): boolean {
  return km.trim() === '' && litros.trim() === '';
}

/**
 * Cada campo es opcional; si hay texto debe ser un número ≥ 0.
 */
export function parseKmLitrosOpcionales(
  km: string,
  litros: string,
):
  | { ok: true; km?: number; litros?: number }
  | { ok: false; message: string } {
  function one(
    s: string,
    label: string,
  ): { ok: true; v?: number } | { ok: false; message: string } {
    const t = s.trim();
    if (t === '') return { ok: true, v: undefined };
    const n = Number(t.replace(',', '.'));
    if (!Number.isFinite(n) || n < 0) {
      return { ok: false, message: `${label} debe ser un número mayor o igual a 0.` };
    }
    return { ok: true, v: n };
  }
  const a = one(km, 'Km recorridos');
  if (!a.ok) return a;
  const b = one(litros, 'Litros consumidos');
  if (!b.ok) return b;
  const out: { km?: number; litros?: number } = {};
  if (a.v !== undefined) out.km = a.v;
  if (b.v !== undefined) out.litros = b.v;
  return { ok: true, ...out };
}

/**
 * Listado de viajes: mostrar atajo «Facturar» solo si el viaje aún no está
 * facturado, cobrado o cancelado (incluye alias legados de API/BD).
 */
export function viajeEstadoPermiteBotonFacturar(estado: string): boolean {
  const e = String(estado).trim().toLowerCase();
  if (e === 'cancelado') return false;
  if (e === 'finalizado_facturado' || e === 'facturado_sin_cobrar') return false;
  if (e === 'finalizado_cobrado' || e === 'cobrado') return false;
  return true;
}

/**
 * Viajes que pueden elegirse al crear/editar una factura (listado de checkboxes).
 * Excluye facturados, cobrados y cancelados (incluye alias legados de API/BD).
 */
export function viajeEstadoPermiteVincularAFactura(estado: string): boolean {
  const e = String(estado).trim().toLowerCase();
  if (e === 'cancelado') return false;
  if (e === 'finalizado_facturado' || e === 'facturado_sin_cobrar') return false;
  if (e === 'finalizado_cobrado' || e === 'cobrado') return false;
  return true;
}

/** Facturado (sin cobrar) o cobrado: el listado puede mostrar el número de factura bajo el viaje. */
export function viajeEstadoEsFacturadoOCobrado(estado: string): boolean {
  const e = String(estado).trim().toLowerCase();
  if (e === 'finalizado_facturado' || e === 'facturado_sin_cobrar') return true;
  if (e === 'finalizado_cobrado' || e === 'cobrado') return true;
  return false;
}

/** Estados que no deben mostrarse en el selector cuando el viaje ya tiene factura asignada. */
const ESTADOS_OCULTOS_CON_FACTURA = new Set(['pendiente', 'en_curso', 'cancelado']);

/**
 * Devuelve los estados disponibles para el selector de un viaje concreto,
 * aplicando las reglas de visibilidad según contexto:
 * - Si ya tiene factura vinculada: oculta pendiente, en_curso, cancelado.
 * - Si ya está vinculado a una factura en el listado actual: oculta finalizado_sin_facturar.
 */
export function estadosDisponiblesParaViaje(
  viaje: {
    id: string;
    nroFactura?: string | null;
    facturaId?: string | null;
    factura?: { id?: string } | null;
  },
  viajesConFactura: Set<string>,
): string[] {
  return VIAJE_ESTADOS_TODOS.filter((x) => {
    if (x === 'finalizado_sin_facturar' && viajesConFactura.has(viaje.id)) return false;
    if (viajeTieneFacturaAsignada(viaje) && ESTADOS_OCULTOS_CON_FACTURA.has(x)) return false;
    return true;
  });
}
