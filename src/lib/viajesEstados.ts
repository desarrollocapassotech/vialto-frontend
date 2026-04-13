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

export const estadoViajeLabel: Record<string, string> = {
  pendiente: 'PENDIENTE',
  en_curso: 'EN CURSO',
  /** Legado si la BD aún no migró */
  finalizado: 'FINALIZADO SIN FACTURAR',
  finalizado_sin_facturar: 'FINALIZADO SIN FACTURAR',
  /** Legado API/BD antes del rename */
  finalizado_facturado: 'FACTURADO SIN COBRAR',
  facturado_sin_cobrar: 'FACTURADO SIN COBRAR',
  /** Legado API/BD */
  finalizado_cobrado: 'COBRADO',
  cobrado: 'COBRADO',
  cancelado: 'CANCELADO',
};

/** Ámbar sin animación (estado Pendiente). */
const BADGE_AMBAR_ESTATICO =
  'bg-amber-100 text-amber-950 border-amber-300/90';

/** Ámbar + titileo (sin facturar / facturado sin cobrar, etc.). */
const BADGE_AMBAR_PENDIENTE =
  'bg-amber-100 text-amber-950 border-amber-300/90 animate-estado-atencion motion-reduce:animate-none';

/** Colores de badge en tablas (Tailwind). */
export const estadoViajeBadgeClass: Record<string, string> = {
  pendiente: BADGE_AMBAR_ESTATICO,
  en_curso:
    'bg-sky-100 text-sky-950 border-sky-400/70 animate-estado-atencion-suave motion-reduce:animate-none',
  finalizado: BADGE_AMBAR_PENDIENTE,
  finalizado_sin_facturar: BADGE_AMBAR_PENDIENTE,
  finalizado_facturado: BADGE_AMBAR_PENDIENTE,
  facturado_sin_cobrar: BADGE_AMBAR_PENDIENTE,
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
 * en facturado sin cobrar ni cobrado (incluye alias legados de API/BD).
 */
export function viajeEstadoPermiteBotonFacturar(estado: string): boolean {
  const e = String(estado).trim().toLowerCase();
  if (e === 'finalizado_facturado' || e === 'facturado_sin_cobrar') return false;
  if (e === 'finalizado_cobrado' || e === 'cobrado') return false;
  return true;
}
