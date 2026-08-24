import { useMemo } from "react";
import { calcularAlertasMantenimiento } from "@/lib/mantenimientoAlertas";
import {
  fmtFechaIntervencion,
  fmtKm,
  fmtTipoIntervencion,
} from "@/lib/mantenimientoLabels";
import type { Intervencion, Vehiculo } from "@/types/api";

export function MantenimientoAlertasSection({
  vehiculos,
  intervenciones,
}: {
  vehiculos: Vehiculo[];
  intervenciones: Intervencion[];
}) {
  const alertas = useMemo(
    () => calcularAlertasMantenimiento(vehiculos, intervenciones),
    [vehiculos, intervenciones],
  );

  const vehiculosPorId = useMemo(
    () => new Map(vehiculos.map((v) => [v.id, v])),
    [vehiculos],
  );

  return (
    <div>
      <p className="text-sm text-vialto-steel max-w-2xl">
        Compara el kilometraje actual de cada vehículo contra el próximo km
        cargado en su última intervención de cada tipo. Cálculo preliminar de
        demo — el margen de anticipación y si también debe correr por fecha
        son reglas todavía pendientes de definir con el cliente.
      </p>

      {alertas.length === 0 ? (
        <p className="mt-6 text-sm text-vialto-steel border border-black/10 bg-vialto-mist/40 px-4 py-6 text-center">
          No hay vehículos próximos a su mantenimiento. Cargá el "próximo km"
          en las intervenciones para que empiecen a calcularse alertas.
        </p>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {alertas.map((alerta) => {
            const vehiculo = vehiculosPorId.get(alerta.vehiculoId);
            const vencido = alerta.severidad === "vencido";
            return (
              <div
                key={`${alerta.vehiculoId}|${alerta.tipo}`}
                className={`border p-4 ${
                  vencido
                    ? "border-red-200 bg-red-50"
                    : "border-amber-200 bg-amber-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-vialto-charcoal">
                    {vehiculo?.patente ?? alerta.vehiculoId}
                  </span>
                  <span
                    className={`text-[10px] uppercase tracking-wider px-2 py-0.5 border ${
                      vencido
                        ? "border-red-300 bg-red-100 text-red-800"
                        : "border-amber-300 bg-amber-100 text-amber-800"
                    }`}
                  >
                    {vencido ? "Vencido" : "Próximo a vencer"}
                  </span>
                </div>
                <p className="mt-2 text-sm text-vialto-steel">
                  {fmtTipoIntervencion(alerta.tipo)}
                </p>
                <p className="mt-2 text-xs text-vialto-steel">
                  Km actual: {fmtKm(alerta.kmActual)} · Próximo:{" "}
                  {fmtKm(alerta.proximoKm)}
                </p>
                <p className="text-xs text-vialto-steel">
                  {vencido
                    ? `Superado por ${fmtKm(Math.abs(alerta.faltanKm))}`
                    : `Faltan ${fmtKm(alerta.faltanKm)}`}
                </p>
                <p className="mt-1 text-[11px] text-vialto-steel/80">
                  Última intervención: {fmtFechaIntervencion(alerta.ultimaFecha)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
