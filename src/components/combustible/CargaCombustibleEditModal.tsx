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
import { FORMA_PAGO_LABELS } from "@/lib/combustibleLabels";
import type { CargaCombustible } from "@/types/api";

function toLocalDateString(isoDate: string | null | undefined) {
  if (!isoDate) return "";
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return "";
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 10);
}

function normalizeFormaPago(val: string | null | undefined): string {
  if (!val) return "";
  return val.trim().toLowerCase();
}

export function CargaCombustibleEditModal({
  carga,
  onClose,
  onSaved,
}: {
  carga: CargaCombustible & {
    choferId?: string | null;
    vehiculoId?: string | null;
    chofer?: { id?: string; nombre: string } | null;
    vehiculo?: { id?: string; patente: string } | null;
  };
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

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      apiJson<{ id: string; nombre: string }[]>("/api/choferes", () =>
        getToken(),
      ).catch(() => []),
      apiJson<{ id: string; patente: string }[]>("/api/vehiculos", () =>
        getToken(),
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
  }, [getToken, carga, initialChoferId, initialVehiculoId]);

  const defaultDate = toLocalDateString(carga.fecha);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const fechaStr = fd.get("fecha") as string;

    const [year, month, day] = fechaStr.split("-").map(Number);
    const payloadDate = new Date(year, month - 1, day, 12, 0, 0);

    const payload = {
      fecha: payloadDate.toISOString(),
      choferId: choferSeleccionado || null,
      vehiculoId: vehiculoSeleccionado || null,
      estacion: fd.get("estacion"),
      litros: Number(fd.get("litros")),
      precioPorLitro: fd.get("precioPorLitro")
        ? Number(fd.get("precioPorLitro"))
        : null,
      importe: Number(fd.get("importe")),
      km: Number(fd.get("km")),
      formaPago: formaPago,
    };

    try {
      await apiJson(
        `/api/combustible/${encodeURIComponent(carga.id)}`,
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
            disabled={saving}
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
              Fecha
            </label>
            <input
              type="date"
              id="fecha"
              name="fecha"
              defaultValue={defaultDate}
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
              Vehículo
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
              Estación de Servicio
            </label>
            <input
              type="text"
              id="estacion"
              name="estacion"
              defaultValue={carga.estacion}
              required
              className="rounded border border-black/20 p-2 text-sm focus:border-vialto-charcoal focus:outline-none focus:ring-1 focus:ring-vialto-charcoal"
            />
          </div>

          <div className="flex flex-col">
            <label
              htmlFor="litros"
              className="mb-1 text-xs font-medium uppercase tracking-wider text-vialto-steel"
            >
              Litros
            </label>
            <input
              type="number"
              step="0.01"
              id="litros"
              name="litros"
              defaultValue={carga.litros}
              required
              className="rounded border border-black/20 p-2 text-sm focus:border-vialto-charcoal focus:outline-none focus:ring-1 focus:ring-vialto-charcoal"
            />
          </div>

          <div className="flex flex-col">
            <label
              htmlFor="precioPorLitro"
              className="mb-1 text-xs font-medium uppercase tracking-wider text-vialto-steel"
            >
              Precio / L ($)
            </label>
            <input
              type="number"
              step="0.01"
              id="precioPorLitro"
              name="precioPorLitro"
              defaultValue={carga.precioPorLitro ?? ""}
              className="rounded border border-black/20 p-2 text-sm focus:border-vialto-charcoal focus:outline-none focus:ring-1 focus:ring-vialto-charcoal"
            />
          </div>

          <div className="flex flex-col">
            <label
              htmlFor="importe"
              className="mb-1 text-xs font-medium uppercase tracking-wider text-vialto-steel"
            >
              Monto Total ($)
            </label>
            <input
              type="number"
              step="0.01"
              id="importe"
              name="importe"
              defaultValue={carga.importe}
              required
              className="rounded border border-black/20 p-2 text-sm focus:border-vialto-charcoal focus:outline-none focus:ring-1 focus:ring-vialto-charcoal"
            />
          </div>

          <div className="flex flex-col">
            <label
              htmlFor="km"
              className="mb-1 text-xs font-medium uppercase tracking-wider text-vialto-steel"
            >
              Kilometraje
            </label>
            <input
              type="number"
              id="km"
              name="km"
              defaultValue={carga.km}
              required
              className="rounded border border-black/20 p-2 text-sm focus:border-vialto-charcoal focus:outline-none focus:ring-1 focus:ring-vialto-charcoal"
            />
          </div>

          <div className="flex flex-col">
            <label
              htmlFor="formaPago"
              className="mb-1 text-xs font-medium uppercase tracking-wider text-vialto-steel"
            >
              Forma de Pago
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
