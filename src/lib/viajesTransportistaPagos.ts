import {
  normalizeViajeMoneda,
  parseCurrencyForMoneda,
  type ViajeMonedaCodigo,
} from '@/lib/currencyMask';
import type { PagoTransportista, Viaje } from '@/types/api';

export type PagoTransportistaMontoDraft = {
  montoStr: string;
  moneda: ViajeMonedaCodigo;
};

export type PagosTransportistaDraftFormInput = {
  transportistaId: string;
  precioTransportistaExterno: string;
  monedaPrecioTransportistaExterno: string | null | undefined;
  pagosTransportista: PagoTransportistaMontoDraft[];
};

export const METODO_PAGO_LABELS: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  cheque: 'Cheque',
  otro: 'Otro',
};

export const METODOS_PAGO = ['efectivo', 'transferencia', 'cheque', 'otro'] as const;
export const PAGO_TRANSPORTISTA_SALDO_ERROR =
  'El monto del pago no puede superar el saldo pendiente del viaje';

export type SaldoTransportistaMeta = {
  moneda: 'ARS' | 'USD';
  totalAcordado: number;
  totalPagado: number;
  saldo: number;
  pagado: boolean;
};

export type ViajeSaldoTransportistaInput = Pick<
  Viaje,
  'transportistaId' | 'precioTransportistaExterno' | 'monedaPrecioTransportistaExterno'
> & {
  pagosTransportista?: PagoTransportista[];
};

export function viajeRequierePagosTransportista(
  v: Pick<Viaje, 'transportistaId'>,
): boolean {
  return !!String(v.transportistaId ?? '').trim();
}

/** Alineado con GET /viajes/paginated?pagoTransportista=… y saldo-pendiente-transportista. */
export type EstadoPagoTransportistaExterno = 'no_aplica' | 'sin_precio' | 'sin_pago' | 'pagado';

function totalPagadoTransportistaEnMonedaAcordada(v: ViajeSaldoTransportistaInput): {
  moneda: 'ARS' | 'USD';
  totalAcordado: number;
  totalPagado: number;
} | null {
  if (!viajeRequierePagosTransportista(v)) return null;
  const moneda = normalizeViajeMoneda(v.monedaPrecioTransportistaExterno);
  const totalAcordado = v.precioTransportistaExterno ?? 0;
  const totalPagado = (v.pagosTransportista ?? [])
    .filter((p) => (p.moneda === 'USD' ? 'USD' : 'ARS') === moneda)
    .reduce((acc, p) => acc + p.monto, 0);
  return { moneda, totalAcordado, totalPagado };
}

/** Transportista externo con precio acordado > 0: pendiente o liquidado al 100 %. */
export function estadoPagoTransportistaExterno(v: Viaje): EstadoPagoTransportistaExterno {
  const t = totalPagadoTransportistaEnMonedaAcordada(v);
  if (!t) return 'no_aplica';
  if (t.totalAcordado <= 0) return 'sin_precio';
  if (t.totalPagado >= t.totalAcordado - 1e-6) return 'pagado';
  return 'sin_pago';
}

export function viajeCoincideFiltroPagoTransportista(
  v: Viaje,
  filtro: 'sin_pagar' | 'pagado',
): boolean {
  const estado = estadoPagoTransportistaExterno(v);
  return filtro === 'sin_pagar' ? estado === 'sin_pago' : estado === 'pagado';
}

export function calcularSaldoTransportista(
  v: ViajeSaldoTransportistaInput,
): SaldoTransportistaMeta | null {
  const t = totalPagadoTransportistaEnMonedaAcordada(v);
  if (!t) return null;

  const saldo = t.totalAcordado - t.totalPagado;
  const pagado = t.totalAcordado > 0 && t.totalPagado >= t.totalAcordado - 1e-6;

  return {
    moneda: t.moneda,
    totalAcordado: t.totalAcordado,
    totalPagado: t.totalPagado,
    saldo,
    pagado,
  };
}

export function validarPagosTransportistaNoSuperanSaldo(
  v: ViajeSaldoTransportistaInput,
): string | null {
  const saldo = calcularSaldoTransportista(v);
  if (!saldo) return null;
  return saldo.totalPagado > saldo.totalAcordado + 1e-6
    ? PAGO_TRANSPORTISTA_SALDO_ERROR
    : null;
}

function totalPagadoDesdeDraftsEnMonedaAcordada(
  rows: PagoTransportistaMontoDraft[],
  monedaAcordada: ViajeMonedaCodigo,
): { totalPagado: number; error: string | null } {
  let totalPagado = 0;

  for (const row of rows) {
    const trimmed = row.montoStr.trim();
    if (!trimmed) continue;

    const monto = parseCurrencyForMoneda(row.montoStr, row.moneda);
    if (monto == null || monto <= 0) {
      return { totalPagado: 0, error: 'Ingresá un monto válido en cada pago al transportista.' };
    }

    const rowMoneda = row.moneda === 'USD' ? 'USD' : 'ARS';
    if (rowMoneda !== monedaAcordada) {
      return {
        totalPagado: 0,
        error: `Los pagos deben estar en ${monedaAcordada}, la moneda acordada con el transportista.`,
      };
    }

    totalPagado += monto;
  }

  return { totalPagado, error: null };
}

/** Saldo en tiempo real desde filas del formulario (crear/editar viaje). */
export function calcularSaldoTransportistaDesdeDraft(
  input: PagosTransportistaDraftFormInput,
): SaldoTransportistaMeta | null {
  if (!viajeRequierePagosTransportista({ transportistaId: input.transportistaId })) {
    return null;
  }

  const moneda = normalizeViajeMoneda(input.monedaPrecioTransportistaExterno);
  const totalAcordado =
    parseCurrencyForMoneda(input.precioTransportistaExterno, moneda) ?? 0;
  const { totalPagado } = totalPagadoDesdeDraftsEnMonedaAcordada(
    input.pagosTransportista,
    moneda,
  );
  const saldo = totalAcordado - totalPagado;
  const pagado = totalAcordado > 0 && totalPagado >= totalAcordado - 1e-6;

  return { moneda, totalAcordado, totalPagado, saldo, pagado };
}

/** Validación alineada con el modal, usando los montos visibles en el formulario. */
export function validarPagosTransportistaDraftForm(
  input: PagosTransportistaDraftFormInput,
): string | null {
  if (!viajeRequierePagosTransportista({ transportistaId: input.transportistaId })) {
    return null;
  }

  const moneda = normalizeViajeMoneda(input.monedaPrecioTransportistaExterno);
  const totalAcordado =
    parseCurrencyForMoneda(input.precioTransportistaExterno, moneda) ?? 0;
  const { totalPagado, error } = totalPagadoDesdeDraftsEnMonedaAcordada(
    input.pagosTransportista,
    moneda,
  );
  if (error) return error;
  if (totalPagado > totalAcordado + 1e-6) {
    return PAGO_TRANSPORTISTA_SALDO_ERROR;
  }
  return null;
}
