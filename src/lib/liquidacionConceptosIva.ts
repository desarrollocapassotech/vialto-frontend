/**
 * IVA por concepto de liquidación (independiente del IVA general del comprobante).
 * El monto persistido es la base; el valor de línea / aporte al total incluye el IVA del concepto.
 */

/** Alícuotas de IVA que acepta AFIP (WSFEv1). Mismo criterio que el backend al emitir. */
export const ALICUOTAS_IVA_AFIP = [0, 2.5, 5, 10.5, 21, 27] as const;

export const ALICUOTAS_IVA_AFIP_LABEL = "0%, 2,5%, 5%, 10,5%, 21% o 27%";

export function esAlicuotaIvaAfip(pct: number | null | undefined): boolean {
  if (pct == null || !Number.isFinite(Number(pct))) return false;
  return ALICUOTAS_IVA_AFIP.some((a) => Math.abs(a - Number(pct)) < 1e-9);
}

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

/** Base del concepto con signo (favor/contra), sin IVA — como la suma al neto gravado del CVLP. */
export function signedMontoNetoConcepto(
  signo: string | null | undefined,
  monto: number,
): number {
  const base = round2(Math.abs(Number(monto) || 0));
  if (!signo) return 0;
  return signo === "contra" ? -base : base;
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
