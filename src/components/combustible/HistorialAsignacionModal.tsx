import { useEffect, useState } from "react";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { fmtTipoVehiculo } from "@/lib/combustibleLabels";
import type { AsignacionVehiculo } from "@/types/api";

function fmtFechaHora(iso: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function HistorialAsignacionModal({
  tenantId,
  choferNombre,
  choferId,
  getToken,
  onClose,
}: {
  tenantId: string;
  choferNombre: string;
  choferId: string;
  getToken: () => Promise<string | null>;
  onClose: () => void;
}) {
  const [historial, setHistorial] = useState<AsignacionVehiculo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiJson<AsignacionVehiculo[]>(
          `/api/platform/combustible/asignaciones/historial?tenantId=${encodeURIComponent(
            tenantId,
          )}&choferId=${encodeURIComponent(choferId)}`,
          () => getToken(),
        );
        if (!cancelled) setHistorial(data);
      } catch (err) {
        if (!cancelled) setError(friendlyError(err, "combustible"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId, choferId, getToken]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="historial-asignacion-titulo"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg border border-black/15 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2
            id="historial-asignacion-titulo"
            className="text-lg font-semibold text-vialto-charcoal"
          >
            Historial de vehículos — {choferNombre}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-vialto-steel hover:text-vialto-charcoal"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {error && (
          <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        {!error && historial === null && (
          <p className="mt-4 text-sm text-vialto-steel">Cargando…</p>
        )}

        {!error && historial !== null && historial.length === 0 && (
          <p className="mt-4 text-sm text-vialto-steel">
            Este chofer todavía no tiene vehículos asignados.
          </p>
        )}

        {!error && historial !== null && historial.length > 0 && (
          <ul className="mt-4 divide-y divide-black/10 max-h-[60vh] overflow-y-auto">
            {historial.map((a) => (
              <li key={a.id} className="py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-vialto-charcoal">
                    {a.vehiculo.patente}
                    <span className="ml-1.5 text-xs font-normal text-vialto-steel">
                      ({fmtTipoVehiculo(a.vehiculo.tipo)})
                    </span>
                  </span>
                  {a.fechaHasta === null && (
                    <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-vialto-mist text-vialto-charcoal">
                      Vigente
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-vialto-steel">
                  {fmtFechaHora(a.fechaDesde)}
                  {" → "}
                  {a.fechaHasta ? fmtFechaHora(a.fechaHasta) : "hoy"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
