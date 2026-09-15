import { useState } from "react";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { useToast } from "@/lib/toast";

export function EditarKmVehiculoModal({
  tenantId,
  vehiculoId,
  patente,
  kmActual,
  getToken,
  onClose,
  onSuccess,
}: {
  tenantId: string;
  vehiculoId: string;
  patente: string;
  kmActual: number;
  getToken: () => Promise<string | null>;
  onClose: () => void;
  onSuccess: (kmActual: number) => void;
}) {
  const { showToast } = useToast();
  const [km, setKm] = useState(String(kmActual));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const kmNumero = Number(km);
  const kmInvalido = km.trim() === "" || Number.isNaN(kmNumero) || kmNumero < 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (kmInvalido) return;
    setLoading(true);
    setError(null);
    try {
      await apiJson(
        `/api/platform/vehiculos/${vehiculoId}?tenantId=${encodeURIComponent(tenantId)}`,
        () => getToken(),
        { method: "PATCH", body: JSON.stringify({ kmActual: kmNumero }) },
      );
      showToast("Kilometraje actualizado correctamente", "success");
      onSuccess(kmNumero);
    } catch (err) {
      setError(friendlyError(err, "combustible"));
      showToast("No se pudo actualizar el kilometraje", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="editar-km-titulo"
      onClick={() => !loading && onClose()}
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
            disabled={loading || kmInvalido}
            className="inline-flex h-10 items-center px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite transition-colors disabled:opacity-50"
          >
            {loading ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </form>
    </div>
  );
}
