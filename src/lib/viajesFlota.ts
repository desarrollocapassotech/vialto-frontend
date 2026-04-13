import type { Chofer, Vehiculo, Viaje } from '@/types/api';

/** Choferes con flota propia (`transportistaId` vacío en maestro). */
export function choferesFlotaPropia(choferes: Chofer[]): Chofer[] {
  return choferes.filter((c) => !c.transportistaId?.trim());
}

/** Vehículos con flota propia. */
export function vehiculosFlotaPropia(vehiculos: Vehiculo[]): Vehiculo[] {
  return vehiculos.filter((v) => !v.transportistaId?.trim());
}

/** Textos de ayuda cuando no hay recursos de flota propia pero sí hay registros “externos”. */
export function mensajesAyudaFlotaPropia(
  choferes: Chofer[],
  vehiculos: Vehiculo[],
): { chofer?: string; vehiculo?: string } {
  const cp = choferesFlotaPropia(choferes);
  const vp = vehiculosFlotaPropia(vehiculos);
  const out: { chofer?: string; vehiculo?: string } = {};
  if (cp.length === 0 && choferes.length > 0) {
    out.chofer =
      'Todos los choferes están asignados a transportistas externos. Para usarlos en flota propia, editá el chofer y elegí «Flota propia», o creá uno nuevo.';
  }
  if (vp.length === 0 && vehiculos.length > 0) {
    out.vehiculo =
      'Todos los vehículos están asignados a transportistas externos. Para flota propia, editá el vehículo y elegí «Flota propia», o cargá uno nuevo.';
  }
  return out;
}

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
