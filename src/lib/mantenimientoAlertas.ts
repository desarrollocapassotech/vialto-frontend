import type { Intervencion, Vehiculo } from "@/types/api";
import { ALERTA_MARGEN_KM, type AlertaMantenimiento } from "./mantenimientoLabels";

/**
 * Calcula alertas de mantenimiento próximo a partir de datos ya reales
 * (Vehiculo.kmActual + Intervencion.proximoKm) — no depende de ningún cálculo
 * del backend (el `Flujo B` del documento funcional todavía no está implementado
 * ahí). Por vehículo y tipo, toma la intervención más reciente que tenga
 * `proximoKm` cargado y la compara contra el km actual del vehículo.
 */
export function calcularAlertasMantenimiento(
  vehiculos: Vehiculo[],
  intervenciones: Intervencion[],
): AlertaMantenimiento[] {
  const vehiculosPorId = new Map(vehiculos.map((v) => [v.id, v]));
  const ultimaPorVehiculoTipo = new Map<string, Intervencion>();

  for (const i of intervenciones) {
    if (i.proximoKm === null || i.proximoKm === undefined) continue;
    const key = `${i.vehiculoId}|${i.tipo}`;
    const actual = ultimaPorVehiculoTipo.get(key);
    if (!actual || new Date(i.fecha) > new Date(actual.fecha)) {
      ultimaPorVehiculoTipo.set(key, i);
    }
  }

  const alertas: AlertaMantenimiento[] = [];
  for (const intervencion of ultimaPorVehiculoTipo.values()) {
    const vehiculo = vehiculosPorId.get(intervencion.vehiculoId);
    if (!vehiculo || !vehiculo.activo || intervencion.proximoKm == null) continue;
    const faltanKm = intervencion.proximoKm - vehiculo.kmActual;
    if (faltanKm > ALERTA_MARGEN_KM) continue;
    alertas.push({
      vehiculoId: vehiculo.id,
      tipo: intervencion.tipo,
      proximoKm: intervencion.proximoKm,
      kmActual: vehiculo.kmActual,
      faltanKm,
      severidad: faltanKm <= 0 ? "vencido" : "proximo",
      ultimaFecha: intervencion.fecha,
    });
  }

  return alertas.sort((a, b) => a.faltanKm - b.faltanKm);
}
