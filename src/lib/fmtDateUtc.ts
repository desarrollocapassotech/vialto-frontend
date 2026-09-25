/**
 * Fecha sin hora persistida en medianoche UTC (CAE, vencimientos, emisión AFIP).
 * En husos detrás de UTC, `toLocaleDateString` local muestra el día anterior.
 */
export function fmtDateUtc(iso: string | null | undefined): string {
  if (!iso) return "—";
  const ymd = iso.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    const [y, m, d] = ymd.split("-");
    return `${d}/${m}/${y}`;
  }
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}
