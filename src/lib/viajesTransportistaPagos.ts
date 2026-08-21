import {
  normalizeViajeMoneda,
  parseCurrencyForMoneda,
  type ViajeMonedaCodigo,
} from "@/lib/currencyMask";
import { signedMontoConIvaConcepto } from "@/lib/liquidacionConceptosIva";
import type { PagoTransportista, Viaje } from "@/types/api";

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
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  cheque: "Cheque",
  otro: "Otro",
};

export const METODOS_PAGO = [
  "efectivo",
  "transferencia",
  "cheque",
  "otro",
] as const;
export const PAGO_TRANSPORTISTA_SALDO_ERROR =
  "El monto del pago no puede superar el saldo pendiente del viaje";

export type SaldoTransportistaMeta = {
  moneda: "ARS" | "USD";
  totalAcordado: number;
  totalPagado: number;
  saldo: number;
  pagado: boolean;
};

export type ViajeSaldoTransportistaInput = Pick<
  Viaje,
  | "id"
  | "transportistaId"
  | "precioTransportistaExterno"
  | "monedaPrecioTransportistaExterno"
  | "precioTransportistaIvaIncluidoPct"
> & {
  liquidacionesViaje?: Array<{
    subtotal?: number | null;
    liquidacion?: {
      estado?: string;
      liquido?: number | null;
      bruto?: number | null;
      comisionPct?: number | null;
      ivaPct?: number | null;
      cantViajes?: number | null;
      conceptosLineas?: Array<{
        monto?: number | null;
        signo?: string | null;
        ivaPct?: number | null;
        viajeId?: string | null;
      }>;
    } | null;
  }> | null;
  pagosTransportista?: PagoTransportista[];
};

export function viajeRequierePagosTransportista(
  v: Pick<Viaje, "transportistaId">,
): boolean {
  return !!String(v.transportistaId ?? "").trim();
}

/** Alineado con GET /viajes/paginated?pagoTransportista=… y saldo-pendiente-transportista. */
export type EstadoPagoTransportistaExterno =
  | "no_aplica"
  | "sin_precio"
  | "sin_pago"
  | "pagado";

/**
 * Suma el IVA a un precio cargado sin IVA. `precioTransportistaExterno` siempre es
 * neto — `precioTransportistaIvaIncluidoPct` es el % que hay que sumarle para saber
 * cuánto se le paga en efectivo al transportista. Espejo exacto de `engrosarConIva`
 * en `viaje-ganancia-bruta.util.ts` (backend). No toca el cálculo de Liquidación/CVLP,
 * que usa el precio neto tal cual (con su propio IVA, configurado aparte).
 */
export function engrosarConIva(precioNeto: number, pct: number): number {
  if (!pct || pct <= 0) return precioNeto;
  return Math.round(precioNeto * (1 + pct / 100) * 100) / 100;
}

/**
 * Calcula el impacto neto de los conceptos de una liquidación sobre UN viaje en particular.
 * - Concepto asignado al viaje -> 100%
 * - Concepto general (sin viajeId) -> Monto dividido la cantidad de viajes de la liquidación
 * - Concepto de otro viaje -> $0
 */
function calcularConceptosParaViaje(
  viajeId: string,
  conceptos: Array<{
    monto?: number | null;
    signo?: string | null;
    ivaPct?: number | null;
    viajeId?: string | null;
  }> = [],
  totalViajesEnLiquidacion: number = 1,
): number {
  const divisor = totalViajesEnLiquidacion > 0 ? totalViajesEnLiquidacion : 1;

  return conceptos.reduce((sum, l) => {
    const monto = Number(l.monto) || 0;
    if (!monto) return sum;

    // Incluye el IVA propio del concepto en el aporte de la línea.
    const conSigno = signedMontoConIvaConcepto(l.signo, monto, l.ivaPct);

    // 1. Asignado específicamente a ESTE viaje (100%)
    if (l.viajeId && String(l.viajeId) === String(viajeId)) {
      return sum + conSigno;
    }

    // 2. Asignado a OTRO viaje (0%)
    if (l.viajeId != null && String(l.viajeId).trim() !== "") {
      return sum;
    }

    // 3. General (viajeId == null/empty) -> se divide por el total de viajes de la liquidación
    return sum + conSigno / divisor;
  }, 0);
}

function totalPagadoTransportistaEnMonedaAcordada(
  v: ViajeSaldoTransportistaInput,
): {
  moneda: "ARS" | "USD";
  totalAcordado: number;
  totalPagado: number;
} | null {
  if (!viajeRequierePagosTransportista(v)) return null;
  const moneda = normalizeViajeMoneda(v.monedaPrecioTransportistaExterno);

  const totalPagado = (v.pagosTransportista ?? [])
    .filter((p) => (p.moneda === "USD" ? "USD" : "ARS") === moneda)
    .reduce((acc, p) => acc + Number(p.monto || 0), 0);

  // 1. Partimos del estimado original como base — cuánto se le debe pagar en
  // efectivo al transportista (el precio cargado, siempre neto, más el % de IVA
  // que se le suma encima, si tiene).
  let totalAcordado = engrosarConIva(
    Number(v.precioTransportistaExterno) || 0,
    Number(v.precioTransportistaIvaIncluidoPct) || 0,
  );

  // 2. Si el viaje tiene liquidaciones emitidas, sobreescribimos con el monto real
  if (v.liquidacionesViaje && v.liquidacionesViaje.length > 0) {
    let montoReal = 0;
    let tieneMontoReal = false;

    for (const lv of v.liquidacionesViaje) {
      const liq = lv.liquidacion;

      // Ignoramos liquidaciones fallidas o anuladas
      if (liq && (liq.estado === "anulado" || liq.estado === "error")) continue;

      // Cálculo detallado contemplando conceptos asignados al viaje o generales divididos
      if (liq && Array.isArray(liq.conceptosLineas) && v.id) {
        // El precio del viaje ya es neto — la Liquidación lo usa tal cual, sin
        // ajustar por el % de IVA del viaje (independiente del IVA que declara la
        // Liquidación, configurado aparte).
        const brutoViaje =
          typeof lv.subtotal === "number"
            ? lv.subtotal
            : Number(v.precioTransportistaExterno) || 0;
        const comisionPct = Number(liq.comisionPct) || 0;
        const comisionMonto = (brutoViaje * comisionPct) / 100;

        const efectoConceptos = calcularConceptosParaViaje(
          v.id,
          liq.conceptosLineas,
          Number(liq.cantViajes) || 1,
        );

        // IVA general solo sobre (bruto − comisión); los conceptos ya traen su IVA.
        const ivaPct = Number(liq.ivaPct) || 0;
        const ivaMonto = ((brutoViaje - comisionMonto) * ivaPct) / 100;

        montoReal += brutoViaje - comisionMonto + ivaMonto + efectoConceptos;
        tieneMontoReal = true;
      }
      // Fallback: Si tenés el monto guardado en la tabla pivote
      else if (typeof lv.subtotal === "number") {
        montoReal += lv.subtotal;
        tieneMontoReal = true;
      }
      // Fallback final: Si no hay monto en pivote ni conceptos cargados, usamos el 'liquido' general
      else if (liq && typeof liq.liquido === "number") {
        montoReal += liq.liquido;
        tieneMontoReal = true;
      }
    }

    if (tieneMontoReal) {
      totalAcordado = montoReal;
    }
  }

  return { moneda, totalAcordado, totalPagado };
}

/** Transportista externo con precio acordado > 0: pendiente o liquidado al 100 %. */
export function estadoPagoTransportistaExterno(
  v: Viaje,
): EstadoPagoTransportistaExterno {
  const t = totalPagadoTransportistaEnMonedaAcordada(v);
  if (!t) return "no_aplica";
  if (t.totalAcordado <= 0) return "sin_precio";
  if (t.totalPagado >= t.totalAcordado - 1e-6) return "pagado";
  return "sin_pago";
}

export function viajeCoincideFiltroPagoTransportista(
  v: Viaje,
  filtro: "sin_pagar" | "pagado",
): boolean {
  const estado = estadoPagoTransportistaExterno(v);
  return filtro === "sin_pagar" ? estado === "sin_pago" : estado === "pagado";
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
      return {
        totalPagado: 0,
        error: "Ingresá un monto válido en cada pago al transportista.",
      };
    }

    const rowMoneda = row.moneda === "USD" ? "USD" : "ARS";
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
  if (
    !viajeRequierePagosTransportista({ transportistaId: input.transportistaId })
  ) {
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
  if (
    !viajeRequierePagosTransportista({ transportistaId: input.transportistaId })
  ) {
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
