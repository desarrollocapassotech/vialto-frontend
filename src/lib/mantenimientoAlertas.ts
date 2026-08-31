import type {
  Intervencion,
  TipoIntervencionMantenimiento,
  Vehiculo,
} from "@/types/api";
import {
  ALERTA_MARGEN_DIAS,
  ALERTA_MARGEN_KM,
  type AlertaMantenimiento,
} from "./mantenimientoLabels";

type UltimaPorVehiculoTipo = Map<
  string,
  { intervencion: Intervencion; tipo: TipoIntervencionMantenimiento }
>;

/** Última intervención (por fecha) que tenga el campo pedido cargado, agrupada por (vehículo, tipo). */
function ultimaConCampoPorVehiculoTipo(
  intervenciones: Intervencion[],
  tieneCampo: (i: Intervencion) => boolean,
): UltimaPorVehiculoTipo {
  const map: UltimaPorVehiculoTipo = new Map();
  for (const i of intervenciones) {
    if (!tieneCampo(i)) continue;
    for (const tipo of i.tipos) {
      const key = `${i.vehiculoId}|${tipo}`;
      const actual = map.get(key);
      if (!actual || new Date(i.fecha) > new Date(actual.intervencion.fecha)) {
        map.set(key, { intervencion: i, tipo });
      }
    }
  }
  return map;
}

/**
 * Calcula alertas de mantenimiento próximo a partir de datos ya reales
 * (Vehiculo.kmActual + Intervencion.proximoKm/proximaFecha) — no depende de
 * ningún cálculo del backend (el `Flujo B` del documento funcional todavía no
 * está implementado ahí). Corren dos criterios en paralelo, cada uno por
 * separado (ver `AlertaMantenimiento`): por km (contra el km actual del
 * vehículo) y por fecha (contra hoy). Por vehículo y tipo, cada criterio toma
 * la intervención más reciente que tenga ese campo cargado.
 */
export function calcularAlertasMantenimiento(
  vehiculos: Vehiculo[],
  intervenciones: Intervencion[],
): AlertaMantenimiento[] {
  const vehiculosPorId = new Map(vehiculos.map((v) => [v.id, v]));
  const alertas: AlertaMantenimiento[] = [];

  const ultimaPorKm = ultimaConCampoPorVehiculoTipo(
    intervenciones,
    (i) => i.proximoKm != null,
  );
  for (const { intervencion, tipo } of ultimaPorKm.values()) {
    const vehiculo = vehiculosPorId.get(intervencion.vehiculoId);
    if (!vehiculo || !vehiculo.activo || intervencion.proximoKm == null) continue;
    const faltanKm = intervencion.proximoKm - vehiculo.kmActual;
    if (faltanKm > ALERTA_MARGEN_KM) continue;
    alertas.push({
      criterio: "km",
      vehiculoId: vehiculo.id,
      tipo,
      proximoKm: intervencion.proximoKm,
      kmActual: vehiculo.kmActual,
      faltanKm,
      severidad: faltanKm <= 0 ? "vencido" : "proximo",
      ultimaFecha: intervencion.fecha,
    });
  }

  const ultimaPorFecha = ultimaConCampoPorVehiculoTipo(
    intervenciones,
    (i) => !!i.proximaFecha,
  );
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  for (const { intervencion, tipo } of ultimaPorFecha.values()) {
    const vehiculo = vehiculosPorId.get(intervencion.vehiculoId);
    if (!vehiculo || !vehiculo.activo || !intervencion.proximaFecha) continue;
    const venc = new Date(intervencion.proximaFecha);
    venc.setHours(0, 0, 0, 0);
    const faltanDias = Math.round(
      (venc.getTime() - hoy.getTime()) / 86_400_000,
    );
    if (faltanDias > ALERTA_MARGEN_DIAS) continue;
    alertas.push({
      criterio: "fecha",
      vehiculoId: vehiculo.id,
      tipo,
      proximaFecha: intervencion.proximaFecha,
      faltanDias,
      severidad: faltanDias <= 0 ? "vencido" : "proximo",
      ultimaFecha: intervencion.fecha,
    });
  }

  // Urgencia normalizada (0..1+ como fracción del margen de cada criterio) para
  // poder ordenar km y fecha en una sola lista pese a tener unidades distintas.
  function urgencia(a: AlertaMantenimiento): number {
    return a.criterio === "km"
      ? a.faltanKm / ALERTA_MARGEN_KM
      : a.faltanDias / ALERTA_MARGEN_DIAS;
  }

  return alertas.sort((a, b) => urgencia(a) - urgencia(b));
}
