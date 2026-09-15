import { useMemo, useState } from "react";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { useToast } from "@/lib/toast";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { fmtTipoVehiculo } from "@/lib/combustibleLabels";
import type { AsignacionVehiculo, Chofer, ConEmpresa, Vehiculo } from "@/types/api";

function fmtVehiculoLabel(v: {
  patente: string;
  tipo: string;
  marca: string | null;
  modelo: string | null;
}): string {
  const tipo = fmtTipoVehiculo(v.tipo);
  const marcaModelo = [v.marca, v.modelo].filter(Boolean).join(" ");
  const detalle = [tipo, marcaModelo].filter(Boolean).join(" · ");
  return detalle ? `${v.patente} — ${detalle}` : v.patente;
}

export function AsignarVehiculoModal({
  tenantId,
  chofer,
  choferes,
  vehiculos,
  getToken,
  onClose,
  onSuccess,
}: {
  tenantId: string;
  /** Si viene fijo (asignar desde la fila de un chofer), el picker de chofer queda bloqueado. */
  chofer?: ConEmpresa<Chofer>;
  choferes: ConEmpresa<Chofer>[];
  vehiculos: ConEmpresa<Vehiculo>[];
  getToken: () => Promise<string | null>;
  onClose: () => void;
  onSuccess: (asignacion: AsignacionVehiculo) => void;
}) {
  const { showToast } = useToast();
  const [choferId, setChoferId] = useState(chofer?.id ?? "");
  const [vehiculoId, setVehiculoId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choferOptions = useMemo(
    () => choferes.map((ch) => ({ value: ch.id, label: ch.nombre })),
    [choferes],
  );
  const vehiculoOptions = useMemo(
    () => vehiculos.map((v) => ({ value: v.id, label: fmtVehiculoLabel(v) })),
    [vehiculos],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!choferId || !vehiculoId) {
      setError("Elegí un chofer y un vehículo.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const asignacion = await apiJson<AsignacionVehiculo>(
        `/api/platform/combustible/asignaciones?tenantId=${encodeURIComponent(tenantId)}`,
        () => getToken(),
        { method: "POST", body: JSON.stringify({ choferId, vehiculoId }) },
      );
      showToast("Vehículo asignado correctamente", "success");
      onSuccess(asignacion);
    } catch (err) {
      setError(friendlyError(err, "combustible"));
      showToast("No se pudo asignar el vehículo", "error");
    } finally {
      setLoading(false);
    }
  }

  const labelClass =
    "block text-xs font-semibold uppercase tracking-wider text-vialto-steel mb-1";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="asignar-vehiculo-titulo"
      onClick={() => !loading && onClose()}
    >
      <form
        className="w-full max-w-md border border-black/15 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h2
          id="asignar-vehiculo-titulo"
          className="text-lg font-semibold text-vialto-charcoal"
        >
          {chofer ? `Asignar vehículo a ${chofer.nombre}` : "Asignar vehículo"}
        </h2>
        <p className="mt-1 text-sm text-vialto-steel">
          Si el chofer ya tenía un vehículo asignado, esa asignación queda cerrada
          y pasa al historial.
        </p>

        <div className="mt-4 space-y-4">
          {!chofer && (
            <div>
              <label className={labelClass}>
                Chofer <span className="text-red-600">*</span>
              </label>
              <SearchableSelect
                value={choferId}
                onChange={setChoferId}
                options={choferOptions}
                placeholder="Elegí un chofer"
                searchPlaceholder="Buscar chofer…"
                ariaLabel="Elegir chofer"
              />
            </div>
          )}
          <div>
            <label className={labelClass}>
              Vehículo <span className="text-red-600">*</span>
            </label>
            <SearchableSelect
              value={vehiculoId}
              onChange={setVehiculoId}
              options={vehiculoOptions}
              placeholder="Elegí un vehículo"
              searchPlaceholder="Buscar vehículo…"
              ariaLabel="Elegir vehículo"
            />
          </div>
        </div>

        {error && (
          <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="inline-flex h-10 items-center px-4 border border-black/15 bg-white text-sm uppercase tracking-wider text-vialto-steel hover:bg-vialto-mist/80 hover:text-vialto-charcoal transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading || !choferId || !vehiculoId}
            className="inline-flex h-10 items-center px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite transition-colors disabled:opacity-50"
          >
            {loading ? "Guardando…" : "Asignar"}
          </button>
        </div>
      </form>
    </div>
  );
}
