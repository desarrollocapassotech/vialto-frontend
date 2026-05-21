import { normalizeViajeMoneda } from '@/lib/currencyMask';
import { formatViajeImporteForListado } from '@/lib/viajesFlota';
import { calcularSaldoTransportista } from '@/lib/viajesTransportistaPagos';
import type { OtroGasto, Viaje } from '@/types/api';

export function viajeUsaFlotaPropia(v: Pick<Viaje, 'transportistaId'>): boolean {
  return !String(v.transportistaId ?? '').trim();
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

export function gananciaBrutaMetaDesdeViaje(v: Viaje): GananciaBrutaMeta {
  const paragraphs: string[] = [];
  const flotaPropia = viajeUsaFlotaPropia(v);

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
