import type { Viaje } from '@/types/api';

/** Orden usado en selects de edición / listado. */
export const VIAJE_ETAPAS_TODAS = ['pendiente', 'en_curso', 'finalizado', 'cancelado'] as const;

/** Solo etapas permitidas al crear un viaje (no finales). */
export const VIAJE_ETAPAS_ALTA = ['pendiente', 'en_curso', 'cancelado'] as const;

export const etapaViajeLabel: Record<string, string> = {
  pendiente: 'PENDIENTE',
  en_curso: 'EN CURSO',
  finalizado: 'FINALIZADO',
  cancelado: 'CANCELADO',
};

const etapaViajeAyuda: Record<string, string> = {
  pendiente: 'Viaje cargado en el sistema: la operación de transporte aún no comenzó.',
  en_curso: 'El servicio está en curso: carga, tránsito o descarga según la etapa.',
  finalizado: 'La operación de transporte ya terminó.',
  cancelado: 'Viaje anulado o no realizado; no corresponde facturar ni liquidar.',
};

export function tooltipEtapaViaje(etapa: string): string {
  return etapaViajeAyuda[etapa] ?? '';
}

const BADGE_PENDIENTE_GRIS = 'bg-zinc-100 text-zinc-800 border-zinc-300/90';

export const etapaViajeBadgeClass: Record<string, string> = {
  pendiente: BADGE_PENDIENTE_GRIS,
  en_curso: 'bg-sky-100 text-sky-950 border-sky-400/70 animate-estado-atencion-suave motion-reduce:animate-none',
  finalizado: 'bg-emerald-100 text-emerald-950 border-emerald-500/80',
  cancelado: 'bg-red-100 text-red-950 border-red-400/80',
};

export const etapaViajeBadgeClassDefault = 'bg-vialto-mist text-vialto-steel border-black/15';

/** Estados disponibles para el selector de etapa (siempre los 4, la edición manual no se restringe). */
export function etapasDisponiblesParaViaje(): string[] {
  return [...VIAJE_ETAPAS_TODAS];
}

/**
 * Permite generar/exportar MIC/CRT en todo el ciclo operativo del viaje.
 * Solo se bloquea en etapa cancelado (sin validez legal ni operativa).
 */
export function viajePermiteGenerarMicCrt(etapa: string): boolean {
  return etapa !== 'cancelado';
}

/** Estados en los que la UI muestra km recorridos y litros consumidos (campos opcionales). */
export function etapaMuestraKmLitros(etapa: string): boolean {
  return etapa === 'finalizado';
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

// ── Facturación al cliente ──────────────────────────────────────────────────

export type FacturacionEstado =
  | 'sin_facturar'
  | 'esperando_afip'
  | 'facturado_parcial'
  | 'facturado'
  | 'cobrado'
  | 'error_afip'
  | 'anulado';

/** Facturación en la que el viaje está disponible para vincular a una factura nueva. */
const FACTURACION_ESTADOS_DISPONIBLES = new Set(['sin_facturar', 'anulado']);

export function facturacionPermiteVincular(facturacionEstado: string): boolean {
  return FACTURACION_ESTADOS_DISPONIBLES.has(facturacionEstado);
}

export const facturacionEstadoLabel: Record<FacturacionEstado, string> = {
  sin_facturar: 'Sin facturar',
  esperando_afip: 'Factura esperando AFIP',
  facturado_parcial: 'Facturado Parcial',
  facturado: 'Facturado',
  cobrado: 'Cobrado',
  error_afip: 'Error de AFIP en factura',
  anulado: 'Factura anulada',
};

/** Clases de color para el badge chico de facturación en la grilla. */
export const facturacionEstadoBadgeClass: Record<FacturacionEstado, string> = {
  sin_facturar: 'bg-zinc-100 text-zinc-800 border-zinc-300/90',
  esperando_afip: 'bg-amber-50 text-amber-950 border-amber-200/95',
  facturado_parcial: 'bg-amber-100 text-amber-950 border-amber-400/80',
  facturado: 'bg-emerald-100 text-emerald-950 border-emerald-500/80',
  cobrado: 'bg-emerald-200 text-emerald-950 border-emerald-600/90',
  error_afip: 'bg-red-100 text-red-950 border-red-400/80',
  anulado: 'bg-red-50 text-red-900 border-red-300/80',
};

/**
 * Estados en los que se pueden agregar gastos adicionales al viaje.
 * Bloqueado en viajes facturados, cobrados y cancelados (mismo criterio que el backend).
 */
export function viajePermiteAgregarGasto(
  v: Pick<Viaje, 'etapa' | 'facturacionEstado'> & {
    clientesViaje?: { facturacionEstado: string | null }[];
  }
): boolean {
  if (v.etapa === 'cancelado') return false;
  
  if (!facturacionPermiteVincular(v.facturacionEstado)) {
    return false;
  }
  
  if (v.clientesViaje && v.clientesViaje.length > 0) {
    const algunoFacturado = v.clientesViaje.some(
      (c) => c.facturacionEstado && !facturacionPermiteVincular(c.facturacionEstado)
    );
    if (algunoFacturado) return false;
  }
  
  return true;
}

export function facturacionLifecycleEstado(
  estado: FacturacionEstado,
): FacturacionEstado {
  return estado;
}

export function tooltipFacturacionEstado(viaje: Pick<Viaje, 'facturacionEstado' | 'factura'>): string {
  const estado = (viaje.facturacionEstado ?? 'sin_facturar') as FacturacionEstado;
  if (estado === 'error_afip' && viaje.factura?.arcaError) {
    return `Error de AFIP: ${viaje.factura.arcaError}`;
  }
  if (estado === 'anulado') {
    return 'Factura anulada (nota de crédito). El viaje está disponible para facturar de nuevo.';
  }
  return facturacionEstadoLabel[estado] ?? estado;
}

// ── Liquidación al transportista ────────────────────────────────────────────

export type LiquidacionEstado =
  | 'sin_liquidar'
  | 'esperando_afip'
  | 'liquidado'
  | 'error_afip'
  | 'anulado';

const LIQUIDACION_ESTADOS_DISPONIBLES = new Set(['sin_liquidar', 'anulado']);

export function liquidacionPermiteVincular(liquidacionEstado: string | null): boolean {
  return liquidacionEstado == null || LIQUIDACION_ESTADOS_DISPONIBLES.has(liquidacionEstado);
}

export const liquidacionEstadoLabel: Record<LiquidacionEstado, string> = {
  sin_liquidar: 'Sin liquidar',
  esperando_afip: 'Liquidación esperando AFIP',
  liquidado: 'Liquidado',
  error_afip: 'Error de AFIP en liquidación',
  anulado: 'Liquidación anulada',
};

export const liquidacionEstadoBadgeClass: Record<LiquidacionEstado, string> = {
  sin_liquidar: 'bg-zinc-100 text-zinc-800 border-zinc-300/90',
  esperando_afip: 'bg-amber-50 text-amber-950 border-amber-200/95',
  liquidado: 'bg-emerald-100 text-emerald-950 border-emerald-500/80',
  error_afip: 'bg-red-100 text-red-950 border-red-400/80',
  anulado: 'bg-red-50 text-red-900 border-red-300/80',
};

export function tooltipLiquidacionEstado(
  viaje: Pick<Viaje, 'liquidacionEstado' | 'liquidacionesViaje'>,
): string {
  const estado = viaje.liquidacionEstado as LiquidacionEstado | null;
  if (!estado) return '';
  if (estado === 'error_afip') {
    const conError = viaje.liquidacionesViaje?.find((lv) => lv.liquidacion.estado === 'error');
    if (conError?.liquidacion.arcaError) {
      return `Error de AFIP: ${conError.liquidacion.arcaError}`;
    }
  }
  if (estado === 'anulado') {
    return 'Liquidación anulada (nota de crédito/débito). El viaje está disponible para liquidar de nuevo.';
  }
  return liquidacionEstadoLabel[estado] ?? estado;
}
