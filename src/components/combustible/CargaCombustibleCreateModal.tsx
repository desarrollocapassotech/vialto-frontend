import { useAuth } from "@clerk/clerk-react";
import { useMemo, useState } from "react";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { useToast } from "@/lib/toast";
import { FORMA_PAGO_LABELS, fmtTipoVehiculo } from "@/lib/combustibleLabels";
import type { CargaCombustible } from "@/types/api";

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

type VehiculoOpt = {
  id: string;
  patente: string;
  tipo: string;
  marca: string | null;
  modelo: string | null;
};
type ChoferOpt = { id: string; nombre: string };

interface Props {
  /** clerkOrgId del tenant sobre el que se registra la carga. */
  tenantId: string;
  /** Flota del tenant elegido (viene del endpoint /platform/vehiculos). */
  vehiculos: VehiculoOpt[];
  /** Conductores del tenant elegido (viene del endpoint /platform/choferes). */
  choferes: ChoferOpt[];
  onClose: () => void;
  onSuccess: (nuevaCarga: CargaCombustible) => void;
}

/**
 * Variante del alta de cargas para el panel de superadmin.
 *
 * A diferencia de CargaCombustibleCreateModal (tenant), NO usa useMaestroData
 * (que está scopeado a la organización propia) ni el hook de validación en vivo
 * de km — recibe la flota/conductores del tenant elegido por props y postea a
 * /api/platform/combustible?tenantId=…
 *
 * La validación fuerte (km sin retroceso + coherencia importe) la garantiza el
 * backend en `create`; acá replicamos solo el chequeo de coherencia de importe
 * (litros × precio ≈ importe) para dar feedback inmediato.
 */
export function CargaCombustibleCreateModal({
  tenantId,
  vehiculos,
  choferes,
  onClose,
  onSuccess,
}: Props) {
  const { getToken } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    fecha: new Date().toISOString().split("T")[0],
    vehiculoId: "",
    choferId: "",
    estacion: "",
    litros: "",
    precioPorLitro: "",
    importe: "",
    km: "",
    formaPago: "",
  });

  // Coherencia importe ≈ litros × precioPorLitro (1% de tolerancia).
  const importeError = useMemo(() => {
    const litros = Number(formData.litros);
    const precio = Number(formData.precioPorLitro);
    const importe = Number(formData.importe);
    if (!litros || !precio || !importe) return null;
    const esperado = litros * precio;
    const diff = Math.abs(importe - esperado);
    if (diff > esperado * 0.01) {
      return `El monto no coincide con litros × precio (esperado ≈ $${esperado.toLocaleString(
        "es-AR",
        { minimumFractionDigits: 2, maximumFractionDigits: 2 },
      )}).`;
    }
    return null;
  }, [formData.litros, formData.precioPorLitro, formData.importe]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (importeError) return;

    setLoading(true);
    setError(null);

    try {
      const kmSanitizado = parseInt(formData.km.replace(/\./g, ""), 10);
      if (isNaN(kmSanitizado)) {
        throw new Error("El kilometraje ingresado no es válido.");
      }

      const payload = {
        ...formData,
        choferId: formData.choferId || null,
        litros: Number(formData.litros),
        precioPorLitro: Number(formData.precioPorLitro),
        importe: Number(formData.importe),
        km: kmSanitizado,
      };

      const nuevaCarga = await apiJson<CargaCombustible>(
        `/api/platform/combustible?tenantId=${encodeURIComponent(tenantId)}`,
        () => getToken(),
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      );

      showToast("Carga registrada exitosamente", "success");
      onSuccess(nuevaCarga);
    } catch (err) {
      setError(friendlyError(err, "combustible"));
      showToast("No se pudo registrar la carga", "error");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "h-9 w-full border border-black/15 bg-white px-2 text-sm text-vialto-charcoal focus:outline-none focus:border-vialto-fire";
  const labelClass =
    "block text-xs font-semibold uppercase tracking-wider text-vialto-steel mb-1";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="nueva-carga-sa-titulo"
    >
      <div className="relative w-full max-w-2xl border border-black/15 bg-white p-6 shadow-xl my-auto">
        <h2
          id="nueva-carga-sa-titulo"
          className="text-xl font-semibold text-vialto-charcoal mb-6 border-b border-black/10 pb-3"
        >
          Registrar nueva carga
        </h2>

        {error && (
          <p className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className={labelClass}>Fecha *</label>
              <input
                type="date"
                name="fecha"
                required
                value={formData.fecha}
                onChange={handleChange}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Estación *</label>
              <input
                type="text"
                name="estacion"
                required
                placeholder="Ej: YPF Ruta 9"
                value={formData.estacion}
                onChange={handleChange}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Vehículo *</label>
              <select
                name="vehiculoId"
                required
                value={formData.vehiculoId}
                onChange={handleChange}
                className={inputClass}
              >
                <option value="" disabled>
                  Seleccione un vehículo...
                </option>
                {vehiculos.map((v) => (
                  <option key={v.id} value={v.id}>
                    {fmtVehiculoLabel(v)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Conductor (Opcional)</label>
              <select
                name="choferId"
                value={formData.choferId}
                onChange={handleChange}
                className={inputClass}
              >
                <option value="">Sin conductor asignado</option>
                {choferes.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Litros *</label>
              <input
                type="number"
                step="0.01"
                min="0.1"
                name="litros"
                required
                value={formData.litros}
                onChange={handleChange}
                className={inputClass}
                placeholder="0.00"
              />
            </div>

            <div>
              <label className={labelClass}>Precio por Litro *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                name="precioPorLitro"
                required
                value={formData.precioPorLitro}
                onChange={handleChange}
                className={inputClass}
                placeholder="0.00"
              />
            </div>

            <div>
              <label className={labelClass}>Monto Total *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                name="importe"
                required
                value={formData.importe}
                onChange={handleChange}
                className={inputClass}
                placeholder="0.00"
              />
              {importeError && (
                <p className="mt-1 text-xs font-semibold text-red-600">
                  ⚠️ {importeError}
                </p>
              )}
            </div>

            <div>
              <label className={labelClass}>Kilómetros *</label>
              <input
                type="text"
                inputMode="numeric"
                name="km"
                required
                value={formData.km}
                onChange={handleChange}
                className={inputClass}
                placeholder="Ej: 450.000"
              />
            </div>

            <div className="sm:col-span-2">
              <label className={labelClass}>Forma de pago *</label>
              <select
                name="formaPago"
                required
                value={formData.formaPago}
                onChange={handleChange}
                className={inputClass}
              >
                <option value="" disabled>
                  Seleccione método...
                </option>
                <option value="efectivo">{FORMA_PAGO_LABELS.efectivo}</option>
                <option value="tarjeta">{FORMA_PAGO_LABELS.tarjeta}</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-3 pt-4 border-t border-black/10">
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
              disabled={loading || Boolean(importeError)}
              className="inline-flex h-10 items-center px-6 bg-vialto-fire text-sm font-medium uppercase tracking-wider text-white hover:bg-orange-600 transition-colors disabled:bg-gray-300 disabled:text-gray-500"
            >
              {loading ? "Guardando..." : "Guardar Carga"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
