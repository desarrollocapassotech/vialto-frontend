import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import type { VehiculoKmEdicion } from "@/types/api";

function fmtFechaHora(iso: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function HistorialKmVehiculoModal({
  tenantId,
  vehiculoId,
  patente,
  onClose,
}: {
  tenantId: string;
  vehiculoId: string;
  patente: string;
  onClose: () => void;
}) {
  const { getToken } = useAuth();
  const [historial, setHistorial] = useState<VehiculoKmEdicion[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiJson<VehiculoKmEdicion[]>(
          `/api/platform/combustible/vehiculos/${vehiculoId}/km-historial?tenantId=${encodeURIComponent(tenantId)}`,
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
    // getToken se omite a propósito: Clerk lo recrea en cada render y no debe disparar un refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, vehiculoId]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="historial-km-titulo"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg border border-black/15 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="historial-km-titulo" className="text-lg font-semibold text-vialto-charcoal">
            Correcciones de kilometraje — {patente}
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
            Este vehículo todavía no tuvo ninguna corrección manual de kilometraje.
          </p>
        )}

        {!error && historial !== null && historial.length > 0 && (
          <ul className="mt-4 divide-y divide-black/10 max-h-[60vh] overflow-y-auto">
            {historial.map((e) => (
              <li key={e.id} className="py-3">
                <div className="flex items-center gap-2">
                  <span className="text-vialto-steel line-through">
                    {e.kmAnterior.toLocaleString("es-AR")} km
                  </span>
                  <span className="text-vialto-steel">→</span>
                  <span className="font-medium text-vialto-charcoal">
                    {e.kmNuevo.toLocaleString("es-AR")} km
                  </span>
                </div>
                <p className="mt-1 text-xs text-vialto-steel">{fmtFechaHora(e.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
