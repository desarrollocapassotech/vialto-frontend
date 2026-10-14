const TZ_AR = "America/Argentina/Buenos_Aires";

/**
 * Día calendario `YYYY-MM-DD` de un valor de fecha de la API.
 *
 * - `YYYY-MM-DD` o medianoche UTC exacta (fecha sin hora: CAE, vencimientos, emisión,
 *   carga de combustible, pagos…): se toma el día literal. Formatearla en hora local
 *   muestra el día anterior (en Argentina, medianoche UTC son las 21 h del día previo).
 * - Cualquier otro instante: el día en hora de Argentina. Formatearlo en UTC muestra
 *   el día siguiente para todo lo ocurrido entre las 21 h y las 24 h.
 */
export function fechaDiaYmd(iso: string | null | undefined): string | null {
  if (!iso) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  if (
    d.getUTCHours() === 0 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0
  ) {
    return d.toISOString().slice(0, 10);
  }
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ_AR }).format(d);
}

/** `DD/MM/YYYY` de un valor de fecha de la API (ver `fechaDiaYmd`). */
export function fmtDateUtc(iso: string | null | undefined): string {
  const ymd = fechaDiaYmd(iso);
  if (!ymd) return "—";
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}
