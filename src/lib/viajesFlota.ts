import { normalizeViajeMoneda } from '@/lib/currencyMask';

import type { Chofer, Cliente, Transportista, Vehiculo, Viaje } from '@/types/api';

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

/** Si `raw` está vacío o ya no está en `lista`, devuelve `''`. No elige el primer ítem por defecto. */
export function mantenerIdSiEnLista<T extends { id: string }>(
  raw: string | number | null | undefined,
  lista: T[],
): string {
  const s = raw != null && raw !== '' ? String(raw).trim() : '';
  if (!s) return '';
  return lista.some((x) => x.id === s) ? s : '';
}

export function vehiculoIdsDesdeRows(rows: { vehiculoId: string }[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of rows) {
    const id = String(r.vehiculoId ?? '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** Flota propia: chofer válido y al menos un vehículo de la lista de flota propia. */
export function flotaPropiaVehiculosListaValida(
  choferId: unknown,
  vehiculoIds: string[],
  choferes: Chofer[],
  vehiculos: Vehiculo[],
): boolean {
  const c = String(choferId ?? '').trim();
  if (!c || vehiculoIds.length === 0) return false;
  if (!choferes.some((x) => x.id === c)) return false;
  const vp = vehiculosFlotaPropia(vehiculos);
  const permitidos = new Set(vp.map((x) => x.id));
  return vehiculoIds.every((id) => permitidos.has(id));
}

/** Número a mostrar en listados: denormalizado en el viaje o el de la factura vinculada (include). */
export function numeroFacturaVisibleViaje(
  v: Pick<Viaje, 'nroFactura'> & { factura?: { numero?: string } | null },
): string {
  const a = v.nroFactura?.trim();
  if (a) return a;
  return (v.factura?.numero ?? '').trim();
}

/** El viaje ya está vinculado a una factura (relación o número en fila). */
export function viajeTieneFacturaAsignada(v: {
  nroFactura?: string | null;
  facturaId?: string | null;
  factura?: { id?: string } | null;
}): boolean {
  if (v.nroFactura != null && String(v.nroFactura).trim() !== '') return true;
  if (v.facturaId != null && String(v.facturaId).trim() !== '') return true;
  if (v.factura?.id != null && String(v.factura.id).trim() !== '') return true;
  return false;
}

/**
 * Viajes que se pueden vincular a una factura según tipo y cliente.
 * Tipo «cliente»: solo viajes de ese `clienteId`. «transportista_externo»: todos (sin filtro por cliente en maestro).
 * Excluye viajes que ya tienen factura asignada, cobrados y cancelados.
 */
export function viajesFiltradosParaFactura(
  todos: Viaje[],
  tipo: 'cliente' | 'transportista_externo',
  clienteId: string,
): Viaje[] {
  let list: Viaje[];
  if (tipo !== 'cliente') {
    list = todos;
  } else {
    const cid = clienteId.trim();
    if (!cid) return [];
    list = todos.filter((v) => v.clienteId === cid);
  }
  return list.filter((v) => {
    if (viajeTieneFacturaAsignada(v)) return false; // ya tiene factura asignada
    if (v.estado === 'cobrado') return false;
    if (v.estado === 'cancelado') return false;
    return true;
  });
}

/** Celda de tabla: monto a facturar. */
export function textoMontoFacturarListado(v: Viaje): string {
  const m = v.monto;
  if (m == null) return '—';
  const moneda = normalizeViajeMoneda(v.monedaMonto);
  const sym = moneda === 'USD' ? 'US$' : '$';
  const locale = moneda === 'USD' ? 'en-US' : 'es-AR';
  return `${sym} ${m.toLocaleString(locale)}`;
}

/**
 * Nombre del cliente en tablas de viajes: relación del API o búsqueda por `clienteId` en el maestro cargado.
 */
export function nombreClienteListadoViaje(v: Viaje, clientes?: Cliente[]): string {
  const desdeApi = v.cliente?.nombre?.trim();
  if (desdeApi) return desdeApi;
  const cid = v.clienteId?.trim();
  if (cid && clientes?.length) {
    const c = clientes.find((x) => x.id === cid);
    if (c?.nombre?.trim()) return c.nombre.trim();
  }
  return '—';
}

const FLOTA_PROPIA_LISTADO = 'Flota propia';

/**
 * Transportista externo (nombre) o «Flota propia» si el viaje no tiene `transportistaId`.
 */
export function nombreTransportistaExternoListadoViaje(
  v: Viaje,
  transportistas?: Transportista[],
): string {
  const tid = v.transportistaId?.trim();
  if (!tid) return FLOTA_PROPIA_LISTADO;

  const desdeApi = v.transportista?.nombre?.trim();
  if (desdeApi) return desdeApi;
  if (transportistas?.length) {
    const t = transportistas.find((x) => x.id === tid);
    if (t?.nombre?.trim()) return t.nombre.trim();
  }
  return '—';
}

/**
 * Suma importes de viajes seleccionados, separando ARS y USD (no mezcla montos entre monedas).
 */
export function textoImporteFacturaSeleccion(viajeIds: string[], viajes: Viaje[]): string {
  let ars = 0;
  let usd = 0;
  for (const id of viajeIds) {
    const v = viajes.find((x) => x.id === id);
    if (!v || v.monto == null) continue;
    if (normalizeViajeMoneda(v.monedaMonto) === 'USD') usd += v.monto;
    else ars += v.monto;
  }
  const parts: string[] = [];
  if (ars > 0) {
    parts.push(
      `$ ${ars.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ARS`,
    );
  }
  if (usd > 0) {
    parts.push(
      `US$ ${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    );
  }
  if (parts.length === 0) return '—';
  return parts.join(' · ');
}

/**
 * Importe mostrado en tabla de facturas: usa viajes cargados; si no alcanza, el total persistido (formato ARS).
 */
export function textoImporteFacturaListado(
  f: { viajeIds: string[]; importe: number },
  viajes: Viaje[],
): string {
  const t = textoImporteFacturaSeleccion(f.viajeIds, viajes);
  if (t !== '—') return t;
  if (f.importe != null && Number.isFinite(f.importe) && f.importe !== 0) {
    return `$ ${f.importe.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return '—';
}
