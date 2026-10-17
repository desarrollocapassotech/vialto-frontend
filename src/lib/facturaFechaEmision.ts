/**
 * Fecha de emisión de facturas: "hoy" en hora de Argentina y rango que admite ARCA.
 *
 * Nunca usar `new Date().toISOString()` para el "hoy" de un campo de fecha: da la fecha
 * UTC, que desde las 21 h de Argentina ya es el día siguiente (bug real oct 2026: la
 * fecha de emisión por defecto salía corrida).
 *
 * El rango replica `resolveFechaCbteFactura` del backend (`arca.util.ts`), que es el que
 * decide: AFIP admite para Concepto 1 hasta 5 días antes y 5 después de hoy.
 */
export const FACTURA_FECHA_DIAS_ATRAS = 5;
export const FACTURA_FECHA_DIAS_ADELANTE = 5;

/** Hoy en Argentina, `YYYY-MM-DD` (formato de `<input type="date">`). */
export function hoyArgentinaIso(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(now);
}

function sumarDiasIso(iso: string, dias: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + dias);
  return dt.toISOString().slice(0, 10);
}

/** Días entre la emisión y el vencimiento que se proponen al crear una factura. */
export const FACTURA_DIAS_VENCIMIENTO_DEFAULT = 30;

/** Vencimiento por defecto de una factura nueva: emisión + 30 días (`""` sin emisión). */
export function vencimientoPorDefecto(fechaEmisionIso: string): string {
  return fechaEmisionIso
    ? sumarDiasIso(fechaEmisionIso, FACTURA_DIAS_VENCIMIENTO_DEFAULT)
    : "";
}

/**
 * Al cambiar la emisión, el vencimiento se corre con ella solo si seguía en el valor por
 * defecto (o vacío); si el usuario lo cambió a mano, se respeta.
 */
export function vencimientoAlCambiarEmision(
  emisionAnterior: string,
  vencimientoActual: string,
  emisionNueva: string,
): string {
  const seguiaPorDefecto =
    !vencimientoActual || vencimientoActual === vencimientoPorDefecto(emisionAnterior);
  return seguiaPorDefecto ? vencimientoPorDefecto(emisionNueva) : vencimientoActual;
}

function isoLegible(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** Rango de fechas de emisión que admite ARCA (`min`/`max` del input de fecha). */
export function rangoFechaEmisionArca(now: Date = new Date()): {
  min: string;
  max: string;
} {
  const hoy = hoyArgentinaIso(now);
  return {
    min: sumarDiasIso(hoy, -FACTURA_FECHA_DIAS_ATRAS),
    max: sumarDiasIso(hoy, FACTURA_FECHA_DIAS_ADELANTE),
  };
}

/** Mensaje si la fecha cae fuera del rango de ARCA; `null` si está bien. */
export function errorFechaEmisionArca(
  fechaIso: string,
  now: Date = new Date(),
): string | null {
  if (!fechaIso) return null;
  const { min, max } = rangoFechaEmisionArca(now);
  if (fechaIso >= min && fechaIso <= max) return null;
  return `La fecha de emisión tiene que estar entre el ${isoLegible(min)} y el ${isoLegible(max)} (rango que admite ARCA).`;
}
