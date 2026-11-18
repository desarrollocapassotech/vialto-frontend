import { hoyArgentinaIso } from "@/lib/facturaFechaEmision";
import type { DashboardPeriodKind } from "@/types/ownerDashboard";

/**
 * Rango `YYYY-MM-DD` (hora de Argentina) del selector de período del dashboard, para
 * los endpoints que piden `from`/`to` (financiero, combustible, tablero de cuenta
 * corriente). `null` = período personalizado sin las dos fechas.
 */
export function periodoAFechas(
  period: DashboardPeriodKind,
  customFrom: string,
  customTo: string,
): { from: string; to: string } | null {
  const today = new Date();
  const hoy = hoyArgentinaIso(today);
  if (period === "week") {
    const d = new Date(today);
    d.setDate(d.getDate() - 6);
    return { from: hoyArgentinaIso(d), to: hoy };
  }
  if (period === "month") return { from: `${hoy.slice(0, 8)}01`, to: hoy };
  if (period === "3months") {
    const d = new Date(today);
    d.setMonth(d.getMonth() - 3);
    return { from: hoyArgentinaIso(d), to: hoy };
  }
  if (customFrom && customTo) return { from: customFrom, to: customTo };
  return null;
}
