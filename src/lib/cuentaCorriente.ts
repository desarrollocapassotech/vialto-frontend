import { apiJson } from '@/lib/api';

export type TipoMovimientoCc = 'cargo' | 'pago';
export type TipoContraparte = 'cliente' | 'proveedor';

export type MovimientoCc = {
  id: string;
  clienteId: string | null;
  proveedorId: string | null;
  contraparteId: string;
  viajeId: string | null;
  facturaId: string | null;
  tipo: TipoMovimientoCc;
  origen: string;
  concepto: string;
  importe: number;
  moneda: string;
  fecha: string;
  fechaVencimiento: string | null;
  numeroComprobante: string | null;
  referencia: string | null;
  estadoDisponibilidad: string;
  estadoImputacion: string;
  createdAt: string;
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

export type CreateMovimientoCcInput = {
  clienteId?: string;
  proveedorId?: string;
  tipo: TipoMovimientoCc;
  concepto?: string;
  importe: number;
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

export const ESTADO_IMPUTACION_LABEL: Record<string, string> = {
  no_imputado: 'A cuenta',
  imputado_parcial: 'Imputado parcial',
  imputado: 'Imputado',
};
