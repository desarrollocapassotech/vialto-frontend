/**
 * IVA por concepto de liquidación (independiente del IVA general del comprobante).
 * El monto persistido es la base; el valor de línea / aporte al total incluye el IVA del concepto.
 */

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Base × (1 + iva%). Si no hay alícuota, devuelve la base. */
export function montoConIvaConcepto(
  monto: number,
  ivaPct: number | null | undefined,
): number {
  const base = Number(monto) || 0;
  const pct = Number(ivaPct);
  if (!Number.isFinite(base) || base === 0) return 0;
  if (!Number.isFinite(pct) || pct === 0) return round2(base);
  return round2(base * (1 + pct / 100));
}

/** Importe con signo (favor/contra) ya con IVA del concepto. */
export function signedMontoConIvaConcepto(
  signo: string | null | undefined,
  monto: number,
  ivaPct: number | null | undefined,
): number {
  const conIva = montoConIvaConcepto(monto, ivaPct);
  if (!signo) return 0;
  return signo === "contra" ? -Math.abs(conIva) : Math.abs(conIva);
}

/**
 * Para mostrar una liquidación ya guardada: `gastosAdminIva` persistido es el IVA total
 * de AFIP (flete/comisión + IVA de cada concepto). Como cada concepto se muestra con su
 * IVA incluido, la línea de IVA general solo debe llevar la parte de flete/comisión.
 */
export function ivaFleteComisionDesdeTotal(
  ivaTotal: number,
  conceptos: { signo: string | null | undefined; monto: number; ivaPct?: number | null }[],
): number {
  const ivaConceptos = conceptos.reduce((acc, l) => {
    const base = Math.abs(Number(l.monto) || 0);
    const conIva = signedMontoConIvaConcepto(l.signo, base, l.ivaPct);
    const signedBase = l.signo === "contra" ? -base : l.signo ? base : 0;
    return acc + (conIva - signedBase);
  }, 0);
  return round2((Number(ivaTotal) || 0) - ivaConceptos);
}

/** IVA general del comprobante: solo sobre (bruto − comisión), sin pisar el IVA de cada concepto. */
export function ivaGeneralSobreBase(
  bruto: number,
  comision: number,
  ivaPct: number | null | undefined,
): number {
  const base = round2((Number(bruto) || 0) - (Number(comision) || 0));
  const pct = Number(ivaPct);
  if (!Number.isFinite(pct) || pct === 0) return 0;
  return round2((base * pct) / 100);
}
