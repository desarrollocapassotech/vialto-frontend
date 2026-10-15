import { apiFetch, apiJson, ApiError, extractApiErrorMessage } from '@/lib/api';
import { filenameFromContentDisposition } from '@/lib/downloadFilename';
import { roundMoney2 } from '@/lib/facturaTotales';

/** Lo que se carga a mano: venta/compra (cargo) o cobro/pago. */
export type TipoMovimientoCc = 'cargo' | 'pago';
/**
 * Tipo de un movimiento guardado. `credito` = anulación (nota de crédito): va en el Haber
 * como un cobro pero no es cobranza ni se imputa — ya está aplicada al movimiento que anula.
 */
export type TipoMovimientoCcRegistrado = TipoMovimientoCc | 'credito';
export type TipoContraparte = 'cliente' | 'proveedor';

export type MovimientoCc = {
  id: string;
  clienteId: string | null;
  proveedorId: string | null;
  contraparteId: string;
  viajeId: string | null;
  facturaId: string | null;
  tipo: TipoMovimientoCcRegistrado;
  origen: string;
  concepto: string;
  /** Total del movimiento (con IVA incluido, si se cargó con IVA). Es lo que suma al saldo. */
  importe: number;
  /** Solo ventas/compras manuales cargadas con IVA: importe sin IVA, % y monto de IVA. */
  importeNeto?: number | null;
  ivaPct?: number | null;
  ivaMonto?: number | null;
  moneda: string;
  fecha: string;
  fechaVencimiento: string | null;
  numeroComprobante: string | null;
  referencia: string | null;
  estadoDisponibilidad: string;
  estadoImputacion: string;
  createdAt: string;
  liquidacionId?: string | null;
  /** Solo anulaciones (origen `anulacion`, `tipo: credito`, en el Haber): el movimiento que compensan. */
  anulaMovimientoId?: string | null;
  anulaMovimiento?: { id: string; fecha: string; concepto: string } | null;
  /** Movimiento anulado con su crédito de anulación (VTO-431). */
  anuladoPor?: { id: string; fecha: string } | null;
  /** Se puede cargar/corregir el N° de comprobante desde Cuenta corriente (liquidación sin ARCA o manual). */
  comprobanteEditable?: boolean;
  /**
   * Cuánto de ESTE movimiento puntual sigue sin resolverse (cargo: sin cobrar/pagar;
   * pago: sin imputar). Solo viene poblado en `fetchMovimientos` (`GET .../movimientos`).
   */
  pendiente?: number;
};

export type SaldoPorMoneda = { moneda: string; saldo: number };

export type SaldoContraparteResponse = {
  clienteId?: string;
  proveedorId?: string;
  saldos: SaldoPorMoneda[];
};

export type TableroItem = {
  id: string;
  contraparteId: string;
  contraparteNombre: string | null;
  tipoContraparte: TipoContraparte;
  concepto: string;
  importe: number;
  pendiente: number;
  moneda: string;
  fecha: string;
  fechaVencimiento: string | null;
  estadoDisponibilidad: string;
  numeroComprobante: string | null;
  referencia: string | null;
  vencido: boolean;
};

export type TableroGrupo = { cobrar: TableroItem[]; pagar: TableroItem[] };

export type TableroCcResponse = {
  vencidos: TableroGrupo;
  proximosVencimientos: TableroGrupo;
  sinVencimiento: TableroGrupo;
  totales: {
    porCobrarPendiente: { moneda: string; total: number }[];
    porPagarPendiente: { moneda: string; total: number }[];
  };
};

type GetToken = () => Promise<string | null>;

export function fetchTablero(
  getToken: GetToken,
  opts: { diasProximos?: number; desde?: string; hasta?: string } = {},
) {
  const params = new URLSearchParams();
  params.set('diasProximos', String(opts.diasProximos ?? 15));
  if (opts.desde) params.set('desde', opts.desde);
  if (opts.hasta) params.set('hasta', opts.hasta);
  return apiJson<TableroCcResponse>(
    `/api/cuenta-corriente/tablero?${params.toString()}`,
    getToken,
  );
}

export function fetchMovimientos(
  getToken: GetToken,
  filtros: {
    clienteId?: string;
    proveedorId?: string;
    estado?: string;
    desde?: string;
    hasta?: string;
  } = {},
) {
  const params = new URLSearchParams();
  if (filtros.clienteId) params.set('clienteId', filtros.clienteId);
  if (filtros.proveedorId) params.set('proveedorId', filtros.proveedorId);
  if (filtros.estado) params.set('estado', filtros.estado);
  if (filtros.desde) params.set('desde', filtros.desde);
  if (filtros.hasta) params.set('hasta', filtros.hasta);
  const qs = params.toString();
  return apiJson<MovimientoCc[]>(
    `/api/cuenta-corriente/movimientos${qs ? `?${qs}` : ''}`,
    getToken,
  );
}

export function fetchSaldoCliente(getToken: GetToken, clienteId: string) {
  return apiJson<SaldoContraparteResponse>(
    `/api/cuenta-corriente/saldo/cliente/${encodeURIComponent(clienteId)}`,
    getToken,
  );
}

export function fetchSaldoProveedor(getToken: GetToken, proveedorId: string) {
  return apiJson<SaldoContraparteResponse>(
    `/api/cuenta-corriente/saldo/proveedor/${encodeURIComponent(proveedorId)}`,
    getToken,
  );
}

export type MovimientoExport = {
  id: string;
  fecha: string;
  tipo: TipoMovimientoCcRegistrado;
  origen: string;
  concepto: string;
  referencia: string | null;
  numeroComprobante: string | null;
  moneda: string;
  importe: number;
  estadoDisponibilidad: string;
  estadoImputacion: string;
  saldoAcumulado: number;
};

export type ExportarMovimientosResponse = {
  clienteId: string | null;
  proveedorId: string | null;
  periodo: { desde: string; hasta: string };
  saldoInicial: number;
  saldoFinal: number;
  movimientos: MovimientoExport[];
};

/** Movimientos de un período con saldo acumulado ya calculado — usado para el export a Excel. */
export function fetchExportarMovimientos(
  getToken: GetToken,
  params: { clienteId?: string; proveedorId?: string; desde: string; hasta: string },
) {
  const qs = new URLSearchParams();
  if (params.clienteId) qs.set('clienteId', params.clienteId);
  if (params.proveedorId) qs.set('proveedorId', params.proveedorId);
  qs.set('desde', params.desde);
  qs.set('hasta', params.hasta);
  return apiJson<ExportarMovimientosResponse>(
    `/api/cuenta-corriente/movimientos/exportar?${qs.toString()}`,
    getToken,
  );
}

export type CreateMovimientoCcInput = {
  clienteId?: string;
  proveedorId?: string;
  tipo: TipoMovimientoCc;
  concepto?: string;
  /** Con `ivaPct`, es el importe SIN IVA: el backend registra el total (neto + IVA). */
  importe: number;
  /** % de IVA, solo ventas/compras. Omitido = sin IVA. */
  ivaPct?: number;
  moneda?: string;
  fecha: string;
  fechaVencimiento?: string;
  numeroComprobante?: string;
  formaPago?: string;
  referencia?: string;
};

export function createMovimiento(getToken: GetToken, input: CreateMovimientoCcInput) {
  return apiJson<MovimientoCc>('/api/cuenta-corriente/movimientos', getToken, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function eliminarMovimiento(getToken: GetToken, id: string) {
  return apiJson<void>(`/api/cuenta-corriente/movimientos/${encodeURIComponent(id)}`, getToken, {
    method: 'DELETE',
  });
}

export function crearImputacion(
  getToken: GetToken,
  input: { pagoId: string; cargoId: string; importe: number },
) {
  return apiJson<{ id: string }>('/api/cuenta-corriente/imputaciones', getToken, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** Imputa un cargo con dos cobros/pagos a la vez; el reparto lo decide el servidor (`repartirImputacion`). */
export function crearImputacionMultiple(
  getToken: GetToken,
  input: { cargoId: string; pagoIds: string[] },
) {
  return apiJson<{ imputaciones: Array<{ id: string; pagoId: string; importe: number }> }>(
    '/api/cuenta-corriente/imputaciones/multiple',
    getToken,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

/**
 * Reparto de una imputación con varios cobros/pagos: primero se consume el de menor
 * disponible (desempate: más antiguo por fecha y luego por carga) y el siguiente cubre
 * solo lo que falta. Espejo de `repartirImputacion` del backend
 * (`cuenta-corriente/imputacion-reparto.util.ts`) — mantener ambas iguales.
 */
export function repartirImputacion(
  pendienteCargo: number,
  pagos: Array<{ id: string; disponible: number; fecha: string; createdAt: string }>,
): Array<{ pagoId: string; importe: number }> {
  const ordenados = [...pagos].sort(
    (a, b) =>
      a.disponible - b.disponible ||
      new Date(a.fecha).getTime() - new Date(b.fecha).getTime() ||
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  let restante = roundMoney2(Math.max(0, pendienteCargo));
  return ordenados.map((p) => {
    const importe = roundMoney2(Math.max(0, Math.min(p.disponible, restante)));
    restante = roundMoney2(restante - importe);
    return { pagoId: p.id, importe };
  });
}

/** Carga/corrige el N° de comprobante (factura del proveedor en una liquidación sin ARCA, o movimiento manual). */
export function actualizarComprobanteMovimiento(
  getToken: GetToken,
  id: string,
  numeroComprobante: string | null,
) {
  return apiJson<MovimientoCc>(
    `/api/cuenta-corriente/movimientos/${encodeURIComponent(id)}/comprobante`,
    getToken,
    { method: 'PATCH', body: JSON.stringify({ numeroComprobante }) },
  );
}

export function eliminarImputacion(getToken: GetToken, id: string) {
  return apiJson<{ id: string }>(
    `/api/cuenta-corriente/imputaciones/${encodeURIComponent(id)}`,
    getToken,
    { method: 'DELETE' },
  );
}

export const ESTADO_DISPONIBILIDAD_LABEL: Record<string, string> = {
  pendiente: 'Pendiente',
  parcial: 'Parcial',
  cancelado: 'Cancelado',
  anulado: 'Anulado',
};

/** Estados que se muestran además de los de `estadoDisponibilidad`/`estadoImputacion`. */
export const ESTADO_MOVIMIENTO_EXTRA_LABEL: Record<string, string> = {
  anulacion: 'Anulación',
};

/**
 * Estado a mostrar (y filtrar) de un movimiento. Una anulación (crédito en el Haber)
 * tiene su propio estado; el resto usa el estado de cobro/imputación de siempre.
 */
export function estadoMovimientoCc(m: MovimientoCc): string {
  if (m.origen === 'anulacion') return 'anulacion';
  return m.tipo === 'cargo' ? m.estadoDisponibilidad : m.estadoImputacion;
}

export function estadoMovimientoCcLabel(m: MovimientoCc): string {
  const estado = estadoMovimientoCc(m);
  return (
    ESTADO_MOVIMIENTO_EXTRA_LABEL[estado] ??
    ESTADO_DISPONIBILIDAD_LABEL[estado] ??
    ESTADO_IMPUTACION_LABEL[estado] ??
    estado
  );
}

/**
 * ¿El movimiento suma en el saldo acumulado del historial? Todo suma salvo un cargo
 * anulado SIN su crédito (anulaciones previas a VTO-431, o movimientos de viaje
 * unificados en una factura/liquidación). Espejo de `cuentaEnHistorialCc` del backend.
 */
export function cuentaEnHistorialCc(m: MovimientoCc): boolean {
  if (m.tipo !== 'cargo' || m.estadoDisponibilidad !== 'anulado') return true;
  return !!m.anulaMovimientoId || !!m.anuladoPor;
}

/** Va en el Debe (suma al saldo) o en el Haber (resta: cobro/pago o crédito de anulación). */
export function esDebeCc(m: { tipo: TipoMovimientoCcRegistrado }): boolean {
  return m.tipo === 'cargo';
}

export const ESTADO_IMPUTACION_LABEL: Record<string, string> = {
  no_imputado: 'A cuenta',
  imputado_parcial: 'Imputado parcial',
  imputado: 'Imputado',
};

/** Descarga el blob de una respuesta exitosa, o levanta un `ApiError` legible si falló. */
async function descargarBlobODescartarError(res: Response, fallbackFilename: string) {
  if (!res.ok) {
    let data: unknown;
    try {
      data = await res.json();
    } catch {
      data = undefined;
    }
    throw new ApiError(extractApiErrorMessage(data, res.statusText), res.status, data);
  }
  const filename = filenameFromContentDisposition(res.headers.get('Content-Disposition'), fallbackFilename);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Descarga el PDF del estado de cuenta de una contraparte, por período (dispara el download del navegador). */
export async function descargarEstadoCuentaPdf(
  getToken: GetToken,
  params: { clienteId?: string; proveedorId?: string; desde: string; hasta: string },
) {
  const qs = new URLSearchParams();
  if (params.clienteId) qs.set('clienteId', params.clienteId);
  if (params.proveedorId) qs.set('proveedorId', params.proveedorId);
  qs.set('desde', params.desde);
  qs.set('hasta', params.hasta);
  const res = await apiFetch(`/api/cuenta-corriente/estado-cuenta/pdf?${qs.toString()}`, getToken);
  await descargarBlobODescartarError(res, 'estado-cuenta.pdf');
}

/** Descarga el PDF del listado completo de deudores (todos los pendientes de cobro y de pago). */
export async function descargarListadoDeudoresPdf(getToken: GetToken) {
  const res = await apiFetch('/api/cuenta-corriente/listado-deudores/pdf', getToken);
  await descargarBlobODescartarError(res, 'listado-deudores.pdf');
}
