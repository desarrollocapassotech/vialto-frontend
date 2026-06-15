import { normalizeViajeMoneda } from '@/lib/currencyMask';

import type { Chofer, Cliente, Transportista, Vehiculo, Viaje } from '@/types/api';


export function choferesFlotaPropia(_choferes: Chofer[]): Chofer[] {
  return [];
}


export function vehiculosFlotaPropia(_vehiculos: Vehiculo[]): Vehiculo[] {
  return [];
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
      'No hay choferes con pertenencia de flota propia asignada. La vinculación estará disponible cuando se implemente la asociación con choferes.';
  }
  if (vp.length === 0 && vehiculos.length > 0) {
    out.vehiculo =
      'No hay vehículos con pertenencia de flota propia asignada. La vinculación estará disponible cuando se implemente la asociación con choferes.';
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

/** Une listas de maestro sin duplicar por `id` (p. ej. entidades creadas en la sesión). */
export function mergeMaestroPorId<T extends { id: string }>(base: T[], extras: T[]): T[] {
  if (extras.length === 0) return base;
  const ids = new Set(base.map((x) => x.id));
  return [...base, ...extras.filter((x) => !ids.has(x.id))];
}

function stubCliente(v: Viaje, c: { id: string; nombre: string }): Cliente {
  return {
    id: c.id,
    tenantId: v.tenantId,
    nombre: c.nombre,
    pais: null,
    idFiscal: null,
    email: null,
    telefono: null,
    direccion: null,
    condicionIva: null,
    condicionTributaria: null,
    createdAt: '',
  };
}

function stubTransportista(v: Viaje, t: { id: string; nombre: string }): Transportista {
  return {
    id: t.id,
    tenantId: v.tenantId,
    nombre: t.nombre,
    pais: null,
    idFiscal: null,
    email: null,
    telefono: null,
    domicilio: null,
    condicionIva: null,
    condicionTributaria: null,
    paut: null,
    permisoInternacional: null,
    fechaVencimientoPermiso: null,
    createdAt: '',
  };
}

function stubVehiculo(
  v: Viaje,
  veh: Pick<Vehiculo, 'id' | 'patente' | 'tipo'>,
): Vehiculo {
  return {
    id: veh.id,
    tenantId: v.tenantId,
    patente: veh.patente,
    tipo: veh.tipo,
    marca: null,
    modelo: null,
    año: null,
    anio: null,
    kmActual: 0,
    nroChasis: null,
    poliza: null,
    vencimientoPoliza: null,
    tara: null,
    precinto: null,
    transportistaId: null,
    createdAt: '',
  };
}

/** Stubs mínimos desde relaciones del viaje (para que los selectores muestren la etiqueta). */
export function entidadesMaestroStubsDesdeViaje(v: Viaje): {
  clientes: Cliente[];
  transportistas: Transportista[];
  vehiculos: Vehiculo[];
} {
  const clientes: Cliente[] = [];
  const transportistas: Transportista[] = [];
  const vehiculos: Vehiculo[] = [];

  if (v.cliente) clientes.push(stubCliente(v, v.cliente));
  if (v.transportista) transportistas.push(stubTransportista(v, v.transportista));
  if (v.transportistaEfectivo) {
    transportistas.push(stubTransportista(v, v.transportistaEfectivo));
  }
  for (const vv of v.vehiculosViaje ?? []) {
    if (vv.vehiculo) vehiculos.push(stubVehiculo(v, vv.vehiculo));
  }

  return { clientes, transportistas, vehiculos };
}

export type MaestroListasViaje = {
  clientes: Cliente[];
  choferes: Chofer[];
  transportistas: Transportista[];
  vehiculos: Vehiculo[];
};

/** Listas de maestro para edición: catálogo + stubs del viaje. */
export function maestroListasParaEdicionViaje(
  v: Viaje,
  base: MaestroListasViaje,
): MaestroListasViaje {
  const stubs = entidadesMaestroStubsDesdeViaje(v);
  return {
    clientes: mergeMaestroPorId(base.clientes, stubs.clientes),
    transportistas: mergeMaestroPorId(base.transportistas, stubs.transportistas),
    choferes: base.choferes,
    vehiculos: mergeMaestroPorId(base.vehiculos, stubs.vehiculos),
  };
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

export type ViajesFiltradosParaFacturaOpciones = {
  /**
   * Al editar una factura, los viajes ya vinculados a esa factura no deben excluirse
   * por `viajeTieneFacturaAsignada` (si no, la lista queda vacía y se pierde la selección).
   */
  facturaEdicionId?: string | null;
  /** IDs guardados en la factura (por si el listado de viajes no trae `facturaId` en cada fila). */
  viajeIdsFacturaEdicion?: readonly string[] | null;
};

function viajePerteneceAFacturaEnEdicion(
  v: Viaje,
  facturaId: string,
  viajeIdsFacturaEdicion?: readonly string[] | null,
): boolean {
  if (viajeIdsFacturaEdicion?.includes(v.id)) return true;
  if (v.facturaId === facturaId) return true;
  if (v.factura?.id === facturaId) return true;
  return false;
}

/**
 * Viajes que se pueden vincular a una factura según tipo y contraparte.
 * Tipo «cliente»: viajes del `clienteId` elegido.
 * «transportista_externo»: viajes del `transportistaId` elegido (operación externa).
 * Excluye viajes que ya tienen factura asignada, cobrados y cancelados.
 * Con `opciones` de edición, mantiene visibles los viajes ya vinculados a esa factura.
 */
export function viajesFiltradosParaFactura(
  todos: Viaje[],
  tipo: 'cliente' | 'transportista_externo',
  clienteId: string,
  transportistaId: string,
  opciones?: ViajesFiltradosParaFacturaOpciones,
): Viaje[] {
  let list: Viaje[];
  if (tipo === 'cliente') {
    const cid = clienteId.trim();
    if (!cid) return [];
    list = todos.filter((v) => v.clienteId === cid);
  } else {
    const tid = transportistaId.trim();
    if (!tid) return [];
    list = todos.filter((v) => v.transportistaId === tid);
  }

  const fid = opciones?.facturaEdicionId?.trim() || null;
  const idsFactura = opciones?.viajeIdsFacturaEdicion;

  const base = list.filter((v) => {
    const enEstaFactura = Boolean(fid && viajePerteneceAFacturaEnEdicion(v, fid, idsFactura));

    if (viajeTieneFacturaAsignada(v) && !enEstaFactura) return false;
    if (v.estado === 'cobrado' && !enEstaFactura) return false;
    if (v.estado === 'cancelado' && !enEstaFactura) return false;
    return true;
  });

  if (!fid || !idsFactura?.length) return base;

  const seen = new Set(base.map((v) => v.id));
  const extra: Viaje[] = [];
  for (const id of idsFactura) {
    if (seen.has(id)) continue;
    const v = todos.find((x) => x.id === id);
    if (!v) continue;
    if (tipo === 'cliente' && v.clienteId !== clienteId.trim()) continue;
    if (tipo !== 'cliente' && v.transportistaId !== transportistaId.trim()) continue;
    seen.add(id);
    extra.push(v);
  }
  return [...base, ...extra];
}

/** Formato de importe de viaje alineado con listados (ARS / USD). */
export function formatViajeImporteForListado(
  m: number,
  moneda?: string | null,
): string {
  const mon = normalizeViajeMoneda(moneda);
  const locale = mon === 'USD' ? 'en-US' : 'es-AR';
  const formatted = m.toLocaleString(locale);
  return mon === 'USD' ? `US$ ${formatted}` : `ARS $ ${formatted}`;
}

/** Celda de tabla: monto a facturar. */
export function textoMontoFacturarListado(v: Viaje): string {
  const m = v.monto;
  if (m == null) return '—';
  return formatViajeImporteForListado(m, v.monedaMonto);
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

/** Id del transportista que realiza el flete (scalar API o relación incluida). */
export function transportistaEfectivoIdDesdeViaje(v: Viaje): string {
  return (v.transportistaEfectivoId ?? v.transportistaEfectivo?.id ?? '').trim();
}

export type ViajeTransportistaExternoDraft = {
  operacionModo: 'externo' | 'propio';
  transportistaId: string;
  realizaFlete: boolean;
  transportistaEfectivoId: string;
};

/** Validación cuando el contratante no realiza el flete (subcontratación). */
export function mensajeErrorTransportistaEfectivoExterno(
  slice: ViajeTransportistaExternoDraft,
): string | null {
  if (slice.operacionModo !== 'externo') return null;
  if (!slice.transportistaId.trim()) return null;
  if (slice.realizaFlete) return null;
  if (!slice.transportistaEfectivoId.trim()) {
    return 'Campo obligatorio';
  }
  if (slice.transportistaEfectivoId.trim() === slice.transportistaId.trim()) {
    return 'El transportista que realiza el flete debe ser distinto del contratante.';
  }
  return null;
}

/**
 * Transportista que efectivamente realiza el flete (si difiere del contratante).
 * Devuelve null si el transportista contratante es el mismo que realiza el flete.
 */
export function nombreTransportistaEfectivoListadoViaje(
  v: Viaje,
  transportistas?: Transportista[],
): string | null {
  const eid = transportistaEfectivoIdDesdeViaje(v);
  if (!eid) return null;

  const desdeApi = v.transportistaEfectivo?.nombre?.trim();
  if (desdeApi) return desdeApi;
  if (transportistas?.length) {
    const t = transportistas.find((x) => x.id === eid);
    if (t?.nombre?.trim()) return t.nombre.trim();
  }
  return null;
}

/**
 * Devuelve la moneda única si todos los viajes seleccionados comparten la misma,
 * null si hay mezcla, o 'ARS' si no hay viajes seleccionados.
 */
export function monedaUnicaDeViajes(viajeIds: string[], viajes: Viaje[]): string | null {
  if (viajeIds.length === 0) return 'ARS';
  const monedas = new Set<string>();
  for (const id of viajeIds) {
    const v = viajes.find((x) => x.id === id);
    if (!v) continue;
    monedas.add(normalizeViajeMoneda(v.monedaMonto));
  }
  if (monedas.size === 0) return 'ARS';
  if (monedas.size > 1) return null;
  return [...monedas][0];
}

/**
 * Suma importes de viajes seleccionados, separando ARS y USD (no mezcla montos entre monedas).
 */
export function textoImporteFacturaSeleccion(
  viajeIds: string[],
  viajes: Viaje[],
  tipo: 'cliente' | 'transportista_externo' = 'cliente',
): string {
  let ars = 0;
  let usd = 0;
  for (const id of viajeIds) {
    const v = viajes.find((x) => x.id === id);
    if (!v) continue;

    const esTransportista = tipo === 'transportista_externo';
    const monto = esTransportista ? v.precioTransportistaExterno : v.monto;
    const moneda = esTransportista ? v.monedaPrecioTransportistaExterno : v.monedaMonto;

    if (monto == null) continue;
    if (normalizeViajeMoneda(moneda) === 'USD') usd += monto;
    else ars += monto;
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
