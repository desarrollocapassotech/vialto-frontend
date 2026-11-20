/**
 * IVA por tramo en el pago al transportista (pedido LSF, nov 2026).
 * Espejo de `vialto-backend/src/shared/util/viaje-tramos-transportista.util.ts`:
 * si cambia la cuenta, cambiar los dos.
 *
 * - Cada tramo: detalle + monto (parte del neto) + % de IVA.
 * - Lo que no cubren los tramos usa el % general del viaje.
 * - Sin tramos, el cálculo es el de siempre (un % sobre todo el neto).
 */

export type TramoTransportista = {
  detalle: string;
  monto: number;
  ivaPct: number;
};

/** Tramo en edición: guarda los textos crudos de los inputs. */
export type TramoTransportistaDraft = TramoTransportista & {
  montoStr?: string;
  ivaPctStr?: string;
};

export type ParteIvaTransportista = { base: number; ivaPct: number };

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function normalizarTramosTransportista(raw: unknown): TramoTransportista[] {
  if (!Array.isArray(raw)) return [];
  const out: TramoTransportista[] = [];
  for (const t of raw) {
    if (!t || typeof t !== "object") continue;
    const r = t as Record<string, unknown>;
    const monto = Number(r.monto);
    const ivaPct = Number(r.ivaPct);
    if (!Number.isFinite(monto) || monto <= 0) continue;
    if (!Number.isFinite(ivaPct) || ivaPct < 0 || ivaPct > 100) continue;
    out.push({
      detalle: typeof r.detalle === "string" ? r.detalle.trim() : "",
      monto: round2(monto),
      ivaPct,
    });
  }
  return out;
}

export function partesIvaTransportista(
  neto: number,
  pctGeneral: number | null | undefined,
  tramosRaw: unknown,
): ParteIvaTransportista[] {
  const tramos = normalizarTramosTransportista(tramosRaw);
  if (tramos.length === 0) return [];
  const partes: ParteIvaTransportista[] = tramos.map((t) => ({
    base: t.monto,
    ivaPct: t.ivaPct,
  }));
  const suma = round2(tramos.reduce((s, t) => s + t.monto, 0));
  const resto = round2((Number(neto) || 0) - suma);
  if (resto > 0) partes.push({ base: resto, ivaPct: Number(pctGeneral) || 0 });
  return partes;
}

/** Para la vista previa de la liquidación (mismo payload que arma el backend). */
export function tramosIvaParaLiquidacion(
  bruto: number,
  pctGeneral: number | null | undefined,
  tramosRaw: unknown,
): ParteIvaTransportista[] | undefined {
  const partes = partesIvaTransportista(bruto, pctGeneral, tramosRaw);
  return partes.length > 0 ? partes : undefined;
}

function engrosarSinTramos(neto: number, p: number): number {
  return Math.round(neto * (1 + p / 100) * 100) / 100;
}

export function ivaTransportista(
  neto: number,
  pctGeneral: number | null | undefined,
  tramosRaw?: unknown,
): number {
  const partes = partesIvaTransportista(neto, pctGeneral, tramosRaw);
  if (partes.length === 0) {
    const p = Number(pctGeneral) || 0;
    if (p <= 0) return 0;
    return round2(engrosarSinTramos(neto, p) - neto);
  }
  return round2(
    partes.reduce((s, p) => s + (p.ivaPct > 0 ? round2((p.base * p.ivaPct) / 100) : 0), 0),
  );
}

/** Neto + IVA: lo que se le paga en efectivo al transportista. */
export function engrosarConIva(
  precioNeto: number,
  pct: number | null | undefined,
  tramosRaw?: unknown,
): number {
  if (normalizarTramosTransportista(tramosRaw).length === 0) {
    const p = Number(pct) || 0;
    if (p <= 0) return precioNeto;
    return engrosarSinTramos(precioNeto, p);
  }
  return round2(precioNeto + ivaTransportista(precioNeto, pct, tramosRaw));
}

export function tramoTransportistaCompleto(t: TramoTransportistaDraft): boolean {
  return (
    Boolean(t.detalle.trim()) &&
    Number(t.monto) > 0 &&
    Number.isFinite(t.ivaPct) &&
    t.ivaPct >= 0 &&
    t.ivaPct <= 100
  );
}

/** Mismo criterio que el backend. Null = bien. */
export function validarTramosTransportista(
  tramos: TramoTransportistaDraft[],
  neto: number | null | undefined,
): string | null {
  if (tramos.length === 0) return null;
  if (tramos.some((t) => !tramoTransportistaCompleto(t))) {
    return "Completá descripción, monto e IVA de cada tramo, o quitalo.";
  }
  const n = Number(neto) || 0;
  if (n <= 0) return "Para cargar tramos, primero cargá el precio del transportista.";
  const suma = round2(tramos.reduce((s, t) => s + t.monto, 0));
  if (suma > round2(n) + 0.005) {
    return "La suma de los tramos no puede superar el precio del transportista.";
  }
  return null;
}

export function tramosTransportistaDraftFromApi(raw: unknown): TramoTransportistaDraft[] {
  return normalizarTramosTransportista(raw).map((t) => ({ ...t }));
}

export function tramosTransportistaDraftToApi(
  tramos: TramoTransportistaDraft[],
): TramoTransportista[] {
  return tramos.map((t) => ({
    detalle: t.detalle.trim(),
    monto: round2(t.monto),
    ivaPct: t.ivaPct,
  }));
}
