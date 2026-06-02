import { normalizeViajeMoneda } from '@/lib/currencyMask';
import {
  buildGananciaBrutaResumen,
  monedasFacturacionYPagoDistintas,
  type GananciaBrutaResumen,
} from '@/lib/viajeGananciaBrutaResumen';
import { formatViajeImporteForListado } from '@/lib/viajesFlota';
import { calcularSaldoTransportista } from '@/lib/viajesTransportistaPagos';
import type { OtroGasto, Viaje } from '@/types/api';

export function viajeUsaFlotaPropia(v: Pick<Viaje, 'transportistaId'>): boolean {
  return !String(v.transportistaId ?? '').trim();
}

/** Ganancia manual solo con transportista externo y monedas de facturación vs pago distintas. */
export function viajeRequiereGananciaBrutaManual(
  v: Pick<Viaje, 'transportistaId' | 'monedaMonto' | 'monedaPrecioTransportistaExterno'>,
): boolean {
  if (viajeUsaFlotaPropia(v)) return false;
  return monedasFacturacionYPagoDistintas(v);
}

export function draftRequiereGananciaBrutaManual(draft: {
  operacionModo: 'externo' | 'propio';
  monedaMonto: string;
  monedaPrecioTransportistaExterno: string;
}): boolean {
  if (draft.operacionModo !== 'externo') return false;
  return draft.monedaMonto !== draft.monedaPrecioTransportistaExterno;
}

/** Reenvía ganancia manual en PATCH parciales (p. ej. solo cambio de estado). */
export function gananciaBrutaManualEnPatchParcial(
  v: Pick<Viaje, 'gananciaBrutaManual' | 'monedaGananciaBrutaManual' | 'monedaMonto'>,
): Pick<Viaje, 'gananciaBrutaManual' | 'monedaGananciaBrutaManual'> {
  const manual = v.gananciaBrutaManual;
  if (manual == null || Number.isNaN(Number(manual))) {
    return {};
  }
  return {
    gananciaBrutaManual: manual,
    monedaGananciaBrutaManual: normalizeViajeMoneda(
      v.monedaGananciaBrutaManual ?? v.monedaMonto,
    ),
  };
}

function resumenDesdeViaje(v: Viaje): GananciaBrutaResumen {
  return buildGananciaBrutaResumen({
    monto: v.monto,
    monedaMonto: v.monedaMonto,
    precioTransportistaExterno: v.precioTransportistaExterno,
    monedaPrecioTransportistaExterno: v.monedaPrecioTransportistaExterno,
    otrosGastos: v.otrosGastos,
    gananciaBrutaManual: v.gananciaBrutaManual,
    monedaGananciaBrutaManual: v.monedaGananciaBrutaManual,
  });
}

function gananciaBrutaMetaDesdeResumen(
  resumen: GananciaBrutaResumen,
  v: Viaje,
): GananciaBrutaMeta {
  const paragraphs: string[] = [];
  const flotaPropia = viajeUsaFlotaPropia(v);

  if (resumen.requiereGananciaManual) {
    paragraphs.push(
      'Monedas distintas: importe a facturar y pago al transportista no se convierten. Ingresá la ganancia bruta manual.',
    );
    if (resumen.gananciaBrutaManual != null) {
      paragraphs.push(
        `Ganancia manual (${resumen.monedaGananciaBrutaManual}): ${formatViajeImporteForListado(
          resumen.gananciaBrutaManual,
          resumen.monedaGananciaBrutaManual!,
        )}`,
      );
    }
    for (const linea of resumen.balance) {
      const label =
        linea.tipo === 'gasto_extra'
          ? `Gastos extra (${linea.moneda})`
          : `Resultado (${linea.moneda})`;
      paragraphs.push(`${label}: ${formatViajeImporteForListado(linea.monto, linea.moneda)}`);
    }
    if (resumen.mensaje) paragraphs.push(resumen.mensaje);
    paragraphs.push(...parrafosPagoTransportista(v));

    if (resumen.balance.length === 0) {
      return {
        display: '—',
        reason: 'Pendiente',
        tooltipParagraphs: paragraphs,
      };
    }

    const lineas: BalanceMonedaLinea[] = resumen.balance.map((l) => ({
      moneda: l.moneda,
      balance: l.monto,
      formatted: formatViajeImporteForListado(l.monto, l.moneda),
    }));
    const bimonetario = lineas.length > 1;
    return {
      display: bimonetario
        ? lineas.map((l) => l.formatted).join(' | ')
        : lineas[0]!.formatted,
      lineasBalance: bimonetario ? lineas : undefined,
      tooltipParagraphs: paragraphs,
    };
  }

  return gananciaBrutaMetaAutomatica(v, paragraphs, flotaPropia);
}

export type MonedaBalance = 'ARS' | 'USD';

const ORDEN_MONEDA: MonedaBalance[] = ['USD', 'ARS'];

export type BalanceMonedaLinea = {
  moneda: MonedaBalance;
  balance: number;
  formatted: string;
};

export type GananciaBrutaMeta = {
  display: string;
  tooltipParagraphs: string[];
  /** Razón breve de por qué no se muestra el valor (solo cuando display es '—'). */
  reason?: string;
  /** Una línea por moneda cuando el viaje es multimoneda. */
  lineasBalance?: BalanceMonedaLinea[];
};

type DesgloseMoneda = {
  ingresos: number;
  costoTransportista: number;
  gastosExtra: number;
  gastosCount: number;
};

function desgloseVacio(): DesgloseMoneda {
  return { ingresos: 0, costoTransportista: 0, gastosExtra: 0, gastosCount: 0 };
}

/** Suma de otrosGastos filtrando por moneda. */
function sumaOtrosGastos(gastos: OtroGasto[], moneda: MonedaBalance): number {
  return gastos
    .filter((g) => (g.moneda === 'USD' ? 'USD' : 'ARS') === moneda)
    .reduce((acc, g) => acc + g.monto, 0);
}

function cuentaOtrosGastos(gastos: OtroGasto[], moneda: MonedaBalance): number {
  return gastos.filter((g) => (g.moneda === 'USD' ? 'USD' : 'ARS') === moneda).length;
}

/** Monedas con ingresos o egresos en el viaje (sin convertir). */
export function monedasImplicadasEnViaje(v: Viaje): MonedaBalance[] {
  const set = new Set<MonedaBalance>();
  if (v.monto != null) set.add(normalizeViajeMoneda(v.monedaMonto));
  if (!viajeUsaFlotaPropia(v) && (v.precioTransportistaExterno ?? 0) > 0) {
    set.add(normalizeViajeMoneda(v.monedaPrecioTransportistaExterno));
  }
  for (const g of v.otrosGastos ?? []) {
    set.add(normalizeViajeMoneda(g.moneda));
  }
  return ORDEN_MONEDA.filter((m) => set.has(m));
}

/** Ingresos y egresos por moneda; balance = ingresos − costo transp. − gastos extra. */
export function desgloseBalancesPorMoneda(v: Viaje): Record<MonedaBalance, DesgloseMoneda> {
  const out: Record<MonedaBalance, DesgloseMoneda> = { ARS: desgloseVacio(), USD: desgloseVacio() };
  const gastos = v.otrosGastos ?? [];

  if (v.monto != null) {
    const monedaIng = normalizeViajeMoneda(v.monedaMonto);
    out[monedaIng].ingresos = v.monto;
  }

  if (!viajeUsaFlotaPropia(v)) {
    const costo = v.precioTransportistaExterno ?? 0;
    if (costo > 0) {
      const monedaCosto = normalizeViajeMoneda(v.monedaPrecioTransportistaExterno);
      out[monedaCosto].costoTransportista = costo;
    }
  }

  for (const moneda of ORDEN_MONEDA) {
    out[moneda].gastosExtra = sumaOtrosGastos(gastos, moneda);
    out[moneda].gastosCount = cuentaOtrosGastos(gastos, moneda);
  }

  return out;
}

export function balanceNetoPorMoneda(d: DesgloseMoneda): number {
  return d.ingresos - d.costoTransportista - d.gastosExtra;
}

function monedaTieneMovimiento(d: DesgloseMoneda): boolean {
  return d.ingresos > 0 || d.costoTransportista > 0 || d.gastosExtra > 0;
}

function lineasBalanceDesdeDesglose(
  desglose: Record<MonedaBalance, DesgloseMoneda>,
  monedas: MonedaBalance[],
): BalanceMonedaLinea[] {
  return monedas
    .filter((m) => monedaTieneMovimiento(desglose[m]))
    .map((moneda) => {
      const balance = balanceNetoPorMoneda(desglose[moneda]);
      return {
        moneda,
        balance,
        formatted: formatViajeImporteForListado(balance, moneda),
      };
    });
}

function parrafosTooltipPorMoneda(
  moneda: MonedaBalance,
  d: DesgloseMoneda,
  flotaPropia: boolean,
): string[] {
  const lines: string[] = [];
  if (d.ingresos > 0) {
    lines.push(`Ingresos (${moneda}): +${formatViajeImporteForListado(d.ingresos, moneda)}`);
  }
  if (d.costoTransportista > 0) {
    lines.push(
      `Transportista externo (${moneda}): −${formatViajeImporteForListado(d.costoTransportista, moneda)}`,
    );
  } else if (!flotaPropia && d.ingresos > 0 && monedaTieneMovimiento(d)) {
    lines.push(`Transportista externo (${moneda}): sin cargo (0).`);
  }
  if (d.gastosExtra > 0) {
    lines.push(
      `Gastos extra (${moneda}): −${formatViajeImporteForListado(d.gastosExtra, moneda)} (${d.gastosCount} ítem/s)`,
    );
  }
  if (monedaTieneMovimiento(d)) {
    lines.push(`Resultado (${moneda}): ${formatViajeImporteForListado(balanceNetoPorMoneda(d), moneda)}`);
  }
  return lines;
}

function parrafosPagoTransportista(v: Viaje): string[] {
  const saldoTransp = calcularSaldoTransportista(v);
  if (!saldoTransp || saldoTransp.totalAcordado <= 0) return [];
  if (saldoTransp.pagado) {
    return [
      `Pago al transportista (${saldoTransp.moneda}): liquidado (${formatViajeImporteForListado(
        saldoTransp.totalPagado,
        saldoTransp.moneda,
      )} de ${formatViajeImporteForListado(saldoTransp.totalAcordado, saldoTransp.moneda)}).`,
    ];
  }
  return [
    `Pago al transportista (${saldoTransp.moneda}): pendiente ${formatViajeImporteForListado(
      saldoTransp.saldo,
      saldoTransp.moneda,
    )} (pagado ${formatViajeImporteForListado(saldoTransp.totalPagado, saldoTransp.moneda)}).`,
  ];
}

function gananciaBrutaMetaAutomatica(
  v: Viaje,
  paragraphs: string[],
  flotaPropia: boolean,
): GananciaBrutaMeta {
  if (v.monto == null) {
    paragraphs.push('Imp. a facturar − Trans. ext. − Gastos extra');
    paragraphs.push('Importe a facturar sin cargar en este viaje.');
    return { display: '—', tooltipParagraphs: paragraphs };
  }

  const monedas = monedasImplicadasEnViaje(v);
  const desglose = desgloseBalancesPorMoneda(v);
  const lineas = lineasBalanceDesdeDesglose(desglose, monedas);
  const bimonetario = monedas.length > 1;

  if (bimonetario) {
    paragraphs.push('Balance bimonetario (sin tipo de cambio; cada moneda por separado)');
    for (const moneda of monedas) {
      paragraphs.push(...parrafosTooltipPorMoneda(moneda, desglose[moneda], flotaPropia));
    }
    paragraphs.push(...parrafosPagoTransportista(v));
    return {
      display: lineas.map((l) => l.formatted).join(' | '),
      lineasBalance: lineas,
      tooltipParagraphs: paragraphs,
    };
  }

  const moneda = monedas[0] ?? normalizeViajeMoneda(v.monedaMonto);
  const d = desglose[moneda];
  paragraphs.push('Imp. a facturar − Trans. ext. − Gastos extra');
  if (flotaPropia) {
    paragraphs.push('Transportista externo: sin cargo (flota propia).');
  }
  paragraphs.push(...parrafosTooltipPorMoneda(moneda, d, flotaPropia));
  if (d.gastosExtra <= 0) {
    paragraphs.push('Sin otros gastos.');
  }
  paragraphs.push(...parrafosPagoTransportista(v));

  const balance = balanceNetoPorMoneda(d);
  return {
    display: formatViajeImporteForListado(balance, moneda),
    tooltipParagraphs: paragraphs,
  };
}

export function gananciaBrutaMetaDesdeViaje(v: Viaje): GananciaBrutaMeta {
  if (viajeRequiereGananciaBrutaManual(v)) {
    return gananciaBrutaMetaDesdeResumen(resumenDesdeViaje(v), v);
  }
  return gananciaBrutaMetaAutomatica(v, [], viajeUsaFlotaPropia(v));
}
