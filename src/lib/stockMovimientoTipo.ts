/**
 * Estilo de badges de tipo de movimiento (alineado visualmente con estados de viaje).
 */
export const movimientoStockTipoBadgeColors: Record<string, string> = {
  ingreso: 'bg-emerald-100 text-emerald-950 border-emerald-500/80',
  egreso: 'bg-red-100 text-red-950 border-red-400/80',
};

export const movimientoStockTipoBadgeDefault =
  'bg-vialto-mist text-vialto-steel border-black/15';

const BADGE_BASE =
  'inline-block rounded-sm border text-left font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-wider px-2 py-0.5';

export function movimientoStockTipoBadgeClass(tipo: string | undefined | null): string {
  const k = String(tipo ?? '')
    .trim()
    .toLowerCase();
  const colors = movimientoStockTipoBadgeColors[k] ?? movimientoStockTipoBadgeDefault;
  return `${BADGE_BASE} ${colors}`;
}

/** Clase para cantidad según tipo de movimiento (verde ingreso, rojo egreso). */
export function movimientoStockTipoNumeroClass(tipo: string | undefined | null): string {
  const k = String(tipo ?? '')
    .trim()
    .toLowerCase();
  if (k === 'ingreso') return 'text-emerald-700 font-semibold tabular-nums';
  if (k === 'egreso') return 'text-red-700 font-semibold tabular-nums';
  return 'text-vialto-charcoal tabular-nums';
}

export function movimientoStockTipoLabel(tipo: string | undefined | null): string {
  const k = String(tipo ?? '')
    .trim()
    .toLowerCase();
  if (k === 'ingreso') return 'Ingreso';
  if (k === 'egreso') return 'Egreso';
  return k ? k.charAt(0).toUpperCase() + k.slice(1) : '—';
}
