import { normalizeViajeMoneda } from "@/lib/currencyMask";
import {
  buildGananciaBrutaResumen,
  monedasFacturacionYPagoDistintas,
  type GananciaBrutaResumen,
} from "@/lib/viajeGananciaBrutaResumen";
import { formatViajeImporteForListado } from "@/lib/viajesFlota";
import { calcularSaldoTransportista } from "@/lib/viajesTransportistaPagos";
import type { OtroGasto, Viaje } from "@/types/api";

// --- HELPERS PARA OBTENER EL MONTO REAL O EL ESTIMADO ---

export function getMontoIngreso(
  v: Pick<Viaje, "monto" | "montoFacturadoReal">,
) {
  return v.montoFacturadoReal ?? v.monto;
}
export function getMonedaIngreso(
  v: Pick<Viaje, "monedaMonto" | "monedaMontoFacturadoReal">,
) {
  return normalizeViajeMoneda(
    v.monedaMontoFacturadoReal ?? v.monedaMonto ?? "ARS",
  );
}
export function getCostoTransportista(
  v: Pick<Viaje, "precioTransportistaExterno" | "costoLiquidadoReal">,
) {
  return v.costoLiquidadoReal ?? v.precioTransportistaExterno;
}
export function getMonedaCostoTransportista(
  v: Pick<
    Viaje,
    "monedaPrecioTransportistaExterno" | "monedaCostoLiquidadoReal"
  >,
) {
  return normalizeViajeMoneda(
    v.monedaCostoLiquidadoReal ?? v.monedaPrecioTransportistaExterno ?? "ARS",
  );
}
export function esIngresoReal(v: Pick<Viaje, "montoFacturadoReal">) {
  return v.montoFacturadoReal != null;
}
export function esCostoReal(v: Pick<Viaje, "costoLiquidadoReal">) {
  return v.costoLiquidadoReal != null;
}

// --------------------------------------------------------

export function viajeUsaFlotaPropia(
  v: Pick<Viaje, "transportistaId">,
): boolean {
  return !String(v.transportistaId ?? "").trim();
}

/** Ganancia manual solo con transportista externo y monedas de facturación vs pago distintas. */
export function viajeRequiereGananciaBrutaManual(
  v: Pick<
    Viaje,
    | "transportistaId"
    | "monedaMonto"
    | "monedaPrecioTransportistaExterno"
    | "montoFacturadoReal"
    | "monedaMontoFacturadoReal"
    | "costoLiquidadoReal"
    | "monedaCostoLiquidadoReal"
  >,
): boolean {
  if (viajeUsaFlotaPropia(v)) return false;
  // Si tenemos facturas/liquidaciones, evaluamos la discrepancia con las monedas REALES
  const monIng = v.monedaMontoFacturadoReal ?? v.monedaMonto;
  const monCosto =
    v.monedaCostoLiquidadoReal ?? v.monedaPrecioTransportistaExterno;
  return monIng !== monCosto;
}

export function draftRequiereGananciaBrutaManual(draft: {
  operacionModo: "externo" | "propio" | null;
  monedaMonto: string;
  monedaPrecioTransportistaExterno: string;
}): boolean {
  if (draft.operacionModo !== "externo") return false;
  return draft.monedaMonto !== draft.monedaPrecioTransportistaExterno;
}

export function gananciaBrutaManualEnPatchParcial(
  v: Pick<
    Viaje,
    "gananciaBrutaManual" | "monedaGananciaBrutaManual" | "monedaMonto"
  >,
): Pick<Viaje, "gananciaBrutaManual" | "monedaGananciaBrutaManual"> {
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

export function gananciaBrutaValorOrdenable(v: Viaje): number | null {
  const resumen = resumenDesdeViaje(v);
  if (resumen.gananciaCalculada != null) return resumen.gananciaCalculada;
  if (resumen.gananciaBrutaManual != null) return resumen.gananciaBrutaManual;
  if (resumen.balance.length === 1) return resumen.balance[0]!.monto;
  if (resumen.balance.length > 1) {
    return resumen.balance.reduce((sum, linea) => sum + linea.monto, 0);
  }
  return null;
}

function resumenDesdeViaje(v: Viaje): GananciaBrutaResumen {
  return buildGananciaBrutaResumen({
    monto: getMontoIngreso(v),
    monedaMonto: getMonedaIngreso(v),
    precioTransportistaExterno: getCostoTransportista(v),
    monedaPrecioTransportistaExterno: getMonedaCostoTransportista(v),
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
      "Monedas distintas: importe a facturar y pago al transportista no se convierten. Ingresá la ganancia bruta manual.",
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
        linea.tipo === "gasto_extra"
          ? `Gastos extra (${linea.moneda})`
          : `Resultado (${linea.moneda})`;
      paragraphs.push(
        `${label}: ${formatViajeImporteForListado(linea.monto, linea.moneda)}`,
      );
    }
    if (resumen.mensaje) paragraphs.push(resumen.mensaje);
    paragraphs.push(...parrafosPagoTransportista(v));

    if (resumen.balance.length === 0) {
      return {
        display: "—",
        reason: "Pendiente",
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
        ? lineas.map((l) => l.formatted).join(" | ")
        : lineas[0]!.formatted,
      lineasBalance: bimonetario ? lineas : undefined,
      tooltipParagraphs: paragraphs,
    };
  }

  return gananciaBrutaMetaAutomatica(v, paragraphs, flotaPropia);
}

export type MonedaBalance = "ARS" | "USD";
const ORDEN_MONEDA: MonedaBalance[] = ["USD", "ARS"];

export type BalanceMonedaLinea = {
  moneda: MonedaBalance;
  balance: number;
  formatted: string;
};

export type GananciaBrutaMeta = {
  display: string;
  tooltipParagraphs: string[];
  reason?: string;
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

function sumaOtrosGastos(gastos: OtroGasto[], moneda: MonedaBalance): number {
  return gastos
    .filter((g) => (g.moneda === "USD" ? "USD" : "ARS") === moneda)
    .reduce((acc, g) => acc + g.monto, 0);
}

function cuentaOtrosGastos(gastos: OtroGasto[], moneda: MonedaBalance): number {
  return gastos.filter((g) => (g.moneda === "USD" ? "USD" : "ARS") === moneda)
    .length;
}

export function monedasImplicadasEnViaje(v: Viaje): MonedaBalance[] {
  const set = new Set<MonedaBalance>();
  if (getMontoIngreso(v) != null) set.add(getMonedaIngreso(v));
  if (!viajeUsaFlotaPropia(v) && (getCostoTransportista(v) ?? 0) > 0) {
    set.add(getMonedaCostoTransportista(v));
  }
  for (const g of v.otrosGastos ?? []) {
    set.add(normalizeViajeMoneda(g.moneda));
  }
  return ORDEN_MONEDA.filter((m) => set.has(m));
}

export function desgloseBalancesPorMoneda(
  v: Viaje,
): Record<MonedaBalance, DesgloseMoneda> {
  const out: Record<MonedaBalance, DesgloseMoneda> = {
    ARS: desgloseVacio(),
    USD: desgloseVacio(),
  };
  const gastos = v.otrosGastos ?? [];

  const ingreso = getMontoIngreso(v);
  if (ingreso != null) {
    const monedaIng = getMonedaIngreso(v);
    out[monedaIng].ingresos = ingreso;
  }

  if (!viajeUsaFlotaPropia(v)) {
    const costo = getCostoTransportista(v) ?? 0;
    if (costo > 0) {
      const monedaCosto = getMonedaCostoTransportista(v);
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
  v: Viaje,
): string[] {
  const lines: string[] = [];
  if (d.ingresos > 0) {
    const label = esIngresoReal(v) ? "Real facturado" : "Estimado";
    lines.push(
      `Ingresos (${moneda}): +${formatViajeImporteForListado(d.ingresos, moneda)} (${label})`,
    );
  }
  if (d.costoTransportista > 0) {
    const label = esCostoReal(v) ? "Real liquidado" : "Estimado";
    lines.push(
      `Transportista externo (${moneda}): −${formatViajeImporteForListado(d.costoTransportista, moneda)} (${label})`,
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
    lines.push(
      `Resultado (${moneda}): ${formatViajeImporteForListado(balanceNetoPorMoneda(d), moneda)}`,
    );
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
  const ingMonto = getMontoIngreso(v);
  if (ingMonto == null) {
    paragraphs.push("Imp. a facturar − Trans. ext. − Gastos extra");
    paragraphs.push("Importe a facturar sin cargar en este viaje.");
    return { display: "—", tooltipParagraphs: paragraphs };
  }

  const monedas = monedasImplicadasEnViaje(v);
  const desglose = desgloseBalancesPorMoneda(v);
  const lineas = lineasBalanceDesdeDesglose(desglose, monedas);
  const bimonetario = monedas.length > 1;

  if (bimonetario) {
    paragraphs.push(
      "Balance bimonetario (sin tipo de cambio; cada moneda por separado)",
    );
    for (const moneda of monedas) {
      paragraphs.push(
        ...parrafosTooltipPorMoneda(moneda, desglose[moneda], flotaPropia, v),
      );
    }
    paragraphs.push(...parrafosPagoTransportista(v));
    return {
      display: lineas.map((l) => l.formatted).join(" | "),
      lineasBalance: lineas,
      tooltipParagraphs: paragraphs,
    };
  }

  const moneda = monedas[0] ?? getMonedaIngreso(v);
  const d = desglose[moneda];
  paragraphs.push("Imp. a facturar − Trans. ext. − Gastos extra");
  if (flotaPropia) {
    paragraphs.push("Transportista externo: sin cargo (flota propia).");
  }
  paragraphs.push(...parrafosTooltipPorMoneda(moneda, d, flotaPropia, v));
  if (d.gastosExtra <= 0) {
    paragraphs.push("Sin otros gastos.");
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
