import type { Chofer, Vehiculo, Viaje } from '@/types/api';

/**
 * Alinea el id guardado con una opción real del `<select>` (evita estado vacío cuando el API
 * devolvió un id obsoleto o tipos distintos string/number).
 */
export function normalizarIdEnLista(
  raw: string | number | null | undefined,
  lista: { id: string }[],
): string {
  const s = raw != null && raw !== '' ? String(raw).trim() : '';
  if (s && lista.some((x) => x.id === s)) return s;
  return lista[0]?.id ?? '';
}

export function flotaPropiaListaValida(
  choferId: unknown,
  vehiculoId: unknown,
  choferes: Chofer[],
  vehiculos: Vehiculo[],
): boolean {
  const c = String(choferId ?? '').trim();
  const v = String(vehiculoId ?? '').trim();
  if (!c || !v) return false;
  return choferes.some((x) => x.id === c) && vehiculos.some((x) => x.id === v);
}

/** Celda de tabla: monto a facturar. */
export function textoMontoFacturarListado(v: Viaje): string {
  const m = v.monto;
  return m != null ? `$ ${m.toLocaleString('es-AR')}` : '—';
}
