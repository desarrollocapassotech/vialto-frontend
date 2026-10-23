import { useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@clerk/clerk-react";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { useToast } from "@/lib/toast";
import { ErrorPieModal } from "@/components/shared/ErrorPieModal";
import { useConfirmarDescarte } from "@/hooks/useConfirmarDescarte";

/**
 * Corregir el km de un vehículo. Lo usan Combustible (Asignación de vehículos, ruta de
 * plataforma con `tenantId`) y Mantenimiento (historial del vehículo, ruta de core
 * `POST /api/vehiculos/:id/km`: pasar `url`). Se monta en un portal para quedar encima
 * de otro modal.
 */
export function EditarKmVehiculoModal({
  tenantId,
  url,
  vehiculoId,
  patente,
  kmActual,
  onClose,
  onSuccess,
}: {
  tenantId?: string;
  /** Ruta del POST; por defecto la de Combustible (plataforma). */
  url?: string;
  vehiculoId: string;
  patente: string;
  kmActual: number;
  onClose: () => void;
  onSuccess: (kmActual: number) => void;
}) {
  const { getToken } = useAuth();
  const { showToast } = useToast();
  const [km, setKm] = useState(String(kmActual));
  const [loading, setLoading] = useState(false);
  const descarte = useConfirmarDescarte(onClose);
  const [error, setError] = useState<string | null>(null);

  const kmNumero = Number(km);
  const kmInvalido = km.trim() === "" || Number.isNaN(kmNumero) || kmNumero < 0;
  const endpoint =
    url ?? `/api/platform/combustible/vehiculos/${vehiculoId}/km?tenantId=${encodeURIComponent(tenantId ?? "")}`;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (kmInvalido) return;
    setLoading(true);
    setError(null);
    try {
      await apiJson(endpoint, () => getToken(), { method: "POST", body: JSON.stringify({ kmNuevo: kmNumero }) });
      showToast("Kilometraje actualizado correctamente", "success");
      onSuccess(kmNumero);
    } catch (err) {
      setError(friendlyError(err, "combustible"));
      showToast("No se pudo actualizar el kilometraje", "error");
    } finally {
      setLoading(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="editar-km-titulo"
    >
      <form
        className="w-full max-w-sm border border-black/15 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h2 id="editar-km-titulo" className="text-lg font-semibold text-vialto-charcoal">
          Editar kilometraje — {patente}
        </h2>

        <div className="mt-4">
          <label className="block text-xs font-semibold uppercase tracking-wider text-vialto-steel mb-1">
            Kilometraje actual <span className="text-red-600">*</span>
          </label>
          <input
            type="number"
            min={0}
            step={1}
            value={km}
            onChange={(e) => setKm(e.target.value)}
            autoFocus
            className="h-9 w-full border border-black/15 bg-white px-2 text-sm text-vialto-charcoal focus:outline-none focus:border-vialto-fire"
          />
          {!kmInvalido && kmNumero < kmActual && (
            <p className="mt-1.5 text-xs text-amber-800/90">
              Es menor al km actual ({kmActual.toLocaleString("es-AR")} km). Guardalo solo si es una corrección.
            </p>
          )}
        </div>


        <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
          <ErrorPieModal error={error} />
          <button
            type="button"
            onClick={descarte.solicitarCierre}
            disabled={loading}
            className="inline-flex h-10 items-center px-4 border border-black/15 bg-white text-sm uppercase tracking-wider text-vialto-steel hover:bg-vialto-mist/80 hover:text-vialto-charcoal transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading || kmInvalido}
            className="inline-flex h-10 items-center px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite transition-colors disabled:opacity-50"
          >
            {loading ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </form>
      {descarte.dialogo}
    </div>,
    document.body,
  );
}
