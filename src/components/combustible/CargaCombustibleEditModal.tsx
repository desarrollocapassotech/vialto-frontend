import { useAuth } from "@clerk/clerk-react";
import { useState, useEffect } from "react";
import {
  ViewModalShell,
  viewModalBtnGhost,
  viewModalBtnPrimary,
} from "@/components/ui/ViewModalShell";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { useToast } from "@/lib/toast";
import {
  FORMA_PAGO_LABELS,
  SERVICE_STATIONS,
  computePrecioPorLitro,
} from "@/lib/combustibleLabels";
import { useCombustibleValidation } from "@/lib/combustibleValidation";
import type { CargaCombustible } from "@/types/api";

function toUtcDateString(isoDate: string | null | undefined) {
  if (!isoDate) return "";
  if (typeof isoDate === "string" && isoDate.length >= 10) {
    return isoDate.slice(0, 10);
  }
  return "";
}

function normalizeFormaPago(val: string | null | undefined): string {
  if (!val) return "";
  return val.trim().toLowerCase();
}

export function CargaCombustibleEditModal({
  carga,
  tenantId, // 1. AGREGAMOS EL TENANT ID COMO PROP
  onClose,
  onSaved,
}: {
  carga: CargaCombustible & {
    choferId?: string | null;
    vehiculoId?: string | null;
    chofer?: { id?: string; nombre: string } | null;
    vehiculo?: { id?: string; patente: string } | null;
  };
  tenantId: string; // 1. TIPAMOS EL TENANT ID
  onClose: () => void;
  onSaved: () => void;
}) {
  const { getToken } = useAuth();
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [choferes, setChoferes] = useState<{ id: string; nombre: string }[]>(
    [],
  );
  const [vehiculos, setVehiculos] = useState<{ id: string; patente: string }[]>(
    [],
  );

  const initialChoferId = carga.choferId ?? carga.chofer?.id ?? "";
  const initialVehiculoId = carga.vehiculoId ?? carga.vehiculo?.id ?? "";

  const [formaPago, setFormaPago] = useState(() =>
    normalizeFormaPago(carga.formaPago),
  );
  const [choferSeleccionado, setChoferSeleccionado] = useState(initialChoferId);
  const [vehiculoSeleccionado, setVehiculoSeleccionado] =
    useState(initialVehiculoId);
  const [estacion, setEstacion] = useState(carga.estacion ?? "");

  const defaultDate = toUtcDateString(carga.fecha);
  const [fecha, setFecha] = useState(defaultDate);
  const [litros, setLitros] = useState(String(carga.litros));
  const [precioPorLitro, setPrecioPorLitro] = useState(
    String(carga.precioPorLitro ?? ""),
  );
  const [importe, setImporte] = useState(String(carga.importe));
  const [km, setKm] = useState(String(carga.km));

  // En edición arranca en modo manual para no pisar un precio ya guardado
  // (p. ej. si el usuario solo corrige la fecha y no toca el precio).
  const [precioManual, setPrecioManual] = useState(true);

  // Se deriva en el mismo render que litros/importe (no vía efecto) para que
  // la validación de coherencia nunca vea un precio desactualizado.
  const precioMostrado = precioManual
    ? precioPorLitro
    : computePrecioPorLitro(litros, importe);

  const handlePrecioManualToggle = (checked: boolean) => {
    if (checked) {
      // Al pasar a manual, arranca desde el último valor calculado.
      setPrecioPorLitro(computePrecioPorLitro(litros, importe));
    }
    setPrecioManual(checked);
  };

  const { formErrors } = useCombustibleValidation(
    getToken,
    vehiculoSeleccionado,
    fecha,
    litros,
    precioMostrado,
    importe,
    km,
    carga.id,
  );

  useEffect(() => {
    let cancelled = false;
    // 2. CREAMOS EL QUERY STRING DEL TENANT
    const qsTenant = `?tenantId=${encodeURIComponent(tenantId)}`;

    Promise.all([
      // 3. ACTUALIZAMOS LAS RUTAS DE CHOFERES Y VEHICULOS
      apiJson<{ id: string; nombre: string }[]>(
        `/api/platform/choferes${qsTenant}`,
        () => getToken(),
      ).catch(() => []),
      apiJson<{ id: string; patente: string }[]>(
        `/api/platform/vehiculos${qsTenant}`,
        () => getToken(),
      ).catch(() => []),
    ]).then(([ch, ve]) => {
      if (!cancelled) {
        setChoferes(ch);
        setVehiculos(ve);

        if (!initialChoferId && carga.chofer?.nombre) {
          const match = ch.find((c) => c.nombre === carga.chofer?.nombre);
          if (match) setChoferSeleccionado(match.id);
        }
        if (!initialVehiculoId && carga.vehiculo?.patente) {
          const match = ve.find((v) => v.patente === carga.vehiculo?.patente);
          if (match) setVehiculoSeleccionado(match.id);
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [getToken, carga, initialChoferId, initialVehiculoId, tenantId]); // Agregamos tenantId a las dependencias

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (Object.keys(formErrors).length > 0) return;

    setSaving(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const fechaStr = fd.get("fecha") as string;

    const [year, month, day] = fechaStr.split("-").map(Number);
    const payloadDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));

    const payload = {
      fecha: payloadDate.toISOString(),
      choferId: choferSeleccionado || null,
      vehiculoId: vehiculoSeleccionado || null,
      estacion,
      litros: Number(fd.get("litros")),
      precioPorLitro: Number(precioMostrado),
      importe: Number(fd.get("importe")),
      km: Number(fd.get("km")),
      formaPago: formaPago,
    };

    try {
      // 4. CREAMOS EL QUERY STRING Y ACTUALIZAMOS LA RUTA DEL PATCH
      const qsTenant = `?tenantId=${encodeURIComponent(tenantId)}`;
      await apiJson(
        `/api/platform/combustible/${encodeURIComponent(carga.id)}${qsTenant}`,
        () => getToken(),
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        },
      );
      showToast("Carga de combustible actualizada exitosamente", "success");
      onSaved();
    } catch (err) {
      setError(friendlyError(err, "combustible"));
      showToast("No se pudo actualizar la carga", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    // ... Todo el return se mantiene exactamente igual ...
    <ViewModalShell
      title="Editar Carga de Combustible"
      onClose={saving ? () => {} : onClose}
      footer={
        <div className="flex w-full items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className={viewModalBtnGhost}
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="edit-carga-form"
            disabled={saving || Object.keys(formErrors).length > 0}
            className={viewModalBtnPrimary}
          >
            {saving ? "Guardando..." : "Guardar Cambios"}
          </button>
        </div>
      }
    >
      <form id="edit-carga-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col">
            <label
              htmlFor="fecha"
              className="mb-1 text-xs font-medium uppercase tracking-wider text-vialto-steel"
            >
              Fecha <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              id="fecha"
              name="fecha"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              required
              className="rounded border border-black/20 p-2 text-sm focus:border-vialto-charcoal focus:outline-none focus:ring-1 focus:ring-vialto-charcoal"
            />
          </div>

          <div className="flex flex-col">
            <label
              htmlFor="choferId"
              className="mb-1 text-xs font-medium uppercase tracking-wider text-vialto-steel"
            >
              Conductor
            </label>
            <select
              id="choferId"
              name="choferId"
              value={choferSeleccionado}
              onChange={(e) => setChoferSeleccionado(e.target.value)}
              className="rounded border border-black/20 bg-white p-2 text-sm focus:border-vialto-charcoal focus:outline-none focus:ring-1 focus:ring-vialto-charcoal"
            >
              <option value="">— Seleccionar —</option>
              {choferSeleccionado &&
                !choferes.find((c) => c.id === choferSeleccionado) && (
                  <option value={choferSeleccionado}>
                    {carga.chofer?.nombre ?? "Conductor actual"}
                  </option>
                )}
              {choferes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label
              htmlFor="vehiculoId"
              className="mb-1 text-xs font-medium uppercase tracking-wider text-vialto-steel"
            >
              Vehículo <span className="text-red-500">*</span>
            </label>
            <select
              id="vehiculoId"
              name="vehiculoId"
              value={vehiculoSeleccionado}
              onChange={(e) => setVehiculoSeleccionado(e.target.value)}
              className="rounded border border-black/20 bg-white p-2 text-sm focus:border-vialto-charcoal focus:outline-none focus:ring-1 focus:ring-vialto-charcoal"
            >
              <option value="">— Seleccionar —</option>
              {vehiculoSeleccionado &&
                !vehiculos.find((v) => v.id === vehiculoSeleccionado) && (
                  <option value={vehiculoSeleccionado}>
                    {carga.vehiculo?.patente ?? "Vehículo actual"}
                  </option>
                )}
              {vehiculos.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.patente}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label
              htmlFor="estacion"
              className="mb-1 text-xs font-medium uppercase tracking-wider text-vialto-steel"
            >
              Estación de Servicio <span className="text-red-500">*</span>
            </label>
            <select
              id="estacion"
              name="estacion"
              value={estacion}
              onChange={(e) => setEstacion(e.target.value)}
              required
              className="rounded border border-black/20 bg-white p-2 text-sm focus:border-vialto-charcoal focus:outline-none focus:ring-1 focus:ring-vialto-charcoal"
            >
              <option value="" disabled>
                Seleccionar
              </option>
              {estacion &&
                !SERVICE_STATIONS.includes(
                  estacion as (typeof SERVICE_STATIONS)[number],
                ) && <option value={estacion}>{estacion}</option>}
              {SERVICE_STATIONS.map((station) => (
                <option key={station} value={station}>
                  {station}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label
              htmlFor="litros"
              className="mb-1 text-xs font-medium uppercase tracking-wider text-vialto-steel"
            >
              Litros <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              id="litros"
              name="litros"
              value={litros}
              onChange={(e) => setLitros(e.target.value)}
              required
              className="rounded border border-black/20 p-2 text-sm focus:border-vialto-charcoal focus:outline-none focus:ring-1 focus:ring-vialto-charcoal"
            />
          </div>

          <div className="flex flex-col">
            <label
              htmlFor="importe"
              className="mb-1 text-xs font-medium uppercase tracking-wider text-vialto-steel"
            >
              Monto Total ($) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              id="importe"
              name="importe"
              value={importe}
              onChange={(e) => setImporte(e.target.value)}
              required
              className="rounded border border-black/20 p-2 text-sm focus:border-vialto-charcoal focus:outline-none focus:ring-1 focus:ring-vialto-charcoal"
            />
            {formErrors.importe && (
              <p className="mt-1 text-xs font-semibold text-red-600">
                ⚠️ {formErrors.importe}
              </p>
            )}
          </div>

          <div className="flex flex-col">
            <div className="mb-1 flex items-center justify-between">
              <label
                htmlFor="precioPorLitro"
                className="text-xs font-medium uppercase tracking-wider text-vialto-steel"
              >
                Precio / L ($) <span className="text-red-500">*</span>
              </label>
              <label className="flex items-center gap-1.5 text-xs font-normal normal-case tracking-normal text-vialto-steel cursor-pointer">
                <input
                  type="checkbox"
                  checked={precioManual}
                  onChange={(e) => handlePrecioManualToggle(e.target.checked)}
                  className="accent-vialto-charcoal"
                />
                Editar manualmente
              </label>
            </div>
            <input
              type="number"
              step="0.01"
              id="precioPorLitro"
              name="precioPorLitro"
              value={precioMostrado}
              onChange={(e) => setPrecioPorLitro(e.target.value)}
              disabled={!precioManual}
              required
              className="rounded border border-black/20 bg-white p-2 text-sm focus:border-vialto-charcoal focus:outline-none focus:ring-1 focus:ring-vialto-charcoal disabled:cursor-not-allowed disabled:bg-black/5 disabled:text-vialto-steel"
            />
            {!precioManual && (
              <p className="mt-1 text-xs italic text-vialto-steel">
                Se calcula automáticamente
              </p>
            )}
          </div>

          <div className="flex flex-col">
            <label
              htmlFor="km"
              className="mb-1 text-xs font-medium uppercase tracking-wider text-vialto-steel"
            >
              Kilometraje <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              id="km"
              name="km"
              value={km}
              onChange={(e) => setKm(e.target.value)}
              required
              className="rounded border border-black/20 p-2 text-sm focus:border-vialto-charcoal focus:outline-none focus:ring-1 focus:ring-vialto-charcoal"
            />
            {formErrors.km && (
              <p className="mt-1 text-xs font-semibold text-red-600">
                ⚠️ {formErrors.km}
              </p>
            )}
          </div>

          <div className="flex flex-col">
            <label
              htmlFor="formaPago"
              className="mb-1 text-xs font-medium uppercase tracking-wider text-vialto-steel"
            >
              Forma de Pago <span className="text-red-500">*</span>
            </label>
            <select
              id="formaPago"
              name="formaPago"
              value={formaPago}
              onChange={(e) => setFormaPago(e.target.value)}
              required
              className="rounded border border-black/20 bg-white p-2 text-sm focus:border-vialto-charcoal focus:outline-none focus:ring-1 focus:ring-vialto-charcoal"
            >
              <option value="" disabled>
                Seleccionar
              </option>
              <option value="efectivo">{FORMA_PAGO_LABELS.efectivo}</option>
              <option value="tarjeta">{FORMA_PAGO_LABELS.tarjeta}</option>
              <option value="cuenta_corriente">
                {FORMA_PAGO_LABELS.cuenta_corriente}
              </option>
            </select>
          </div>
        </div>

        <p className="mt-4 text-xs italic text-vialto-steel">
          Nota: Las fotos respaldatorias del ticket y tacómetro son permanentes
          y no pueden ser modificadas desde este panel.
        </p>
      </form>
    </ViewModalShell>
  );
}
