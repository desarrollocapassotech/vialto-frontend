import { useEffect, useState } from "react";
import { apiJson } from "@/lib/api";
import { Spinner } from "@/components/ui/Spinner";
import { friendlyError } from "@/lib/friendlyError";
import { modalOverlayClass } from "@/lib/modalLayers";
import { useToast } from "@/lib/toast";
import { SearchableEntitySelect } from "@/components/forms/SearchableEntitySelect";
import { filtrarVehiculos } from "@/components/forms/maestroSearchFilters";
import { TipoIntervencionSelect } from "@/components/mantenimiento/TipoIntervencionSelect";
import {
  fmtFechaIntervencion,
  fmtKm,
  fmtTiposIntervencion,
} from "@/lib/mantenimientoLabels";
import type { Intervencion, TipoIntervencionMantenimiento, Vehiculo } from "@/types/api";

const INPUT_CLASS = "h-9 w-full border border-black/15 bg-white px-2 text-sm";
const LABEL_CLASS = "text-xs uppercase tracking-[0.08em] text-vialto-steel";

function hoyIso(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .split("T")[0];
}

export function IntervencionModal({
  modo,
  intervencionInicial,
  vehiculos,
  vehiculoIdFiltro,
  getToken,
  onClose,
  onSaved,
  onEdit,
}: {
  modo: "create" | "edit" | "view";
  intervencionInicial?: Intervencion;
  vehiculos: Vehiculo[];
  /** Vehículo preseleccionado al crear desde un filtro ya aplicado en el listado. */
  vehiculoIdFiltro?: string;
  getToken: () => Promise<string | null>;
  onClose: () => void;
  onSaved: (intervencion: Intervencion) => void;
  onEdit?: () => void;
}) {
  const { showToast } = useToast();

  const [vehiculoId, setVehiculoId] = useState(
    intervencionInicial?.vehiculoId ?? vehiculoIdFiltro ?? "",
  );
  const [tipos, setTipos] = useState<TipoIntervencionMantenimiento[]>(
    intervencionInicial?.tipos ?? [],
  );
  const [fecha, setFecha] = useState(
    intervencionInicial?.fecha ? intervencionInicial.fecha.slice(0, 10) : hoyIso(),
  );
  const [km, setKm] = useState(
    intervencionInicial?.km != null ? String(intervencionInicial.km) : "",
  );
  const [kmTocadoManualmente, setKmTocadoManualmente] = useState(false);
  const [proximoKm, setProximoKm] = useState(
    intervencionInicial?.proximoKm != null
      ? String(intervencionInicial.proximoKm)
      : "",
  );
  const [proximaFecha, setProximaFecha] = useState(
    intervencionInicial?.proximaFecha
      ? intervencionInicial.proximaFecha.slice(0, 10)
      : "",
  );
  const [descripcion, setDescripcion] = useState(
    intervencionInicial?.descripcion ?? "",
  );

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const readOnly = modo === "view";
  const vehiculo = vehiculos.find((v) => v.id === intervencionInicial?.vehiculoId);

  // Al crear (no al editar), el km al momento se autocompleta con el km
  // actual del vehículo elegido; se detiene en cuanto el usuario lo edita
  // a mano, para no pisarle un valor que ya escribió.
  useEffect(() => {
    if (modo !== "create" || kmTocadoManualmente) return;
    const v = vehiculos.find((x) => x.id === vehiculoId);
    if (v && v.kmActual > 0) {
      setKm(String(v.kmActual));
    }
  }, [modo, vehiculoId, vehiculos, kmTocadoManualmente]);

  async function submit() {
    const errs: Record<string, string> = {};
    if (!vehiculoId) errs.vehiculoId = "Seleccioná un vehículo.";
    if (tipos.length === 0) errs.tipos = "Seleccioná al menos un tipo.";
    if (!fecha) errs.fecha = "Ingresá la fecha.";
    if (km && (isNaN(Number(km)) || Number(km) < 0)) {
      errs.km = "El km debe ser un número válido.";
    }
    if (proximoKm && (isNaN(Number(proximoKm)) || Number(proximoKm) < 0)) {
      errs.proximoKm = "El próximo km debe ser un número válido.";
    }
    if (tipos.includes("otro") && !descripcion.trim()) {
      errs.descripcion = "Ingresá una descripción para el tipo \"Otro\".";
    }
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setSaving(true);
    setError(null);

    try {
      const body: Record<string, unknown> = {
        vehiculoId,
        tipos,
        fecha,
        descripcion: descripcion.trim() || undefined,
        km: km ? Number(km) : undefined,
        proximoKm: proximoKm ? Number(proximoKm) : undefined,
        proximaFecha: proximaFecha || undefined,
      };

      let result: Intervencion;
      if (modo === "create") {
        result = await apiJson<Intervencion>(
          "/api/mantenimiento/intervenciones",
          () => getToken(),
          { method: "POST", body: JSON.stringify(body) },
        );
      } else {
        result = await apiJson<Intervencion>(
          `/api/mantenimiento/intervenciones/${encodeURIComponent(intervencionInicial!.id)}`,
          () => getToken(),
          { method: "PATCH", body: JSON.stringify(body) },
        );
      }
      showToast("Intervención guardada correctamente", "success");
      onSaved(result);
    } catch (e) {
      setError(friendlyError(e, "mantenimiento"));
      showToast("No se pudo guardar la intervención", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={modalOverlayClass}>
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-2xl rounded border border-black/10 bg-white shadow-lg"
      >
        <div className="flex items-center justify-between border-b border-black/10 px-5 pt-5 pb-4">
          <h2 className="font-[family-name:var(--font-display)] text-xl tracking-wide">
            {modo === "create"
              ? "Nueva intervención"
              : (vehiculo?.patente ?? "Intervención")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="h-8 w-8 flex items-center justify-center text-vialto-steel hover:bg-vialto-mist text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-4 grid gap-3 max-h-[90vh] overflow-y-auto">
          {readOnly ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className={LABEL_CLASS}>Vehículo</p>
                  <p className="mt-1 text-sm">{vehiculo?.patente ?? "—"}</p>
                </div>
                <div>
                  <p className={LABEL_CLASS}>Fecha de intervención</p>
                  <p className="mt-1 text-sm">
                    {intervencionInicial
                      ? fmtFechaIntervencion(intervencionInicial.fecha)
                      : "—"}
                  </p>
                </div>
              </div>
              <div>
                <p className={LABEL_CLASS}>Tipo</p>
                <p className="mt-1 text-sm">
                  {fmtTiposIntervencion(intervencionInicial?.tipos ?? [])}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className={LABEL_CLASS}>Km al momento</p>
                  <p className="mt-1 text-sm">{fmtKm(intervencionInicial?.km)}</p>
                </div>
                <div>
                  <p className={LABEL_CLASS}>Próximo km</p>
                  <p className="mt-1 text-sm">
                    {fmtKm(intervencionInicial?.proximoKm)}
                  </p>
                </div>
                <div>
                  <p className={LABEL_CLASS}>Fecha de vencimiento</p>
                  <p className="mt-1 text-sm">
                    {intervencionInicial?.proximaFecha
                      ? fmtFechaIntervencion(intervencionInicial.proximaFecha)
                      : "—"}
                  </p>
                </div>
              </div>
              {intervencionInicial?.descripcion?.trim() && (
                <div>
                  <p className={LABEL_CLASS}>Descripción</p>
                  <p className="mt-1 text-sm">{intervencionInicial.descripcion}</p>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className={LABEL_CLASS}>
                    Vehículo <span className="text-red-500">*</span>
                  </span>
                  <SearchableEntitySelect<Vehiculo>
                    items={vehiculos.filter((v) => v.activo || v.id === vehiculoId)}
                    value={vehiculoId}
                    onChange={setVehiculoId}
                    filterItems={filtrarVehiculos}
                    getPrimaryLabel={(v) => v.patente}
                    getSecondaryLabel={(v) =>
                      [v.marca, v.modelo].filter(Boolean).join(" · ") || null
                    }
                    placeholderCerrado="Seleccioná un vehículo…"
                    placeholderBuscar="Buscar patente o marca…"
                    searchAriaLabel="Filtrar vehículos"
                    aria-label="Vehículo"
                    inputClassName={`${INPUT_CLASS} ${fieldErrors.vehiculoId ? "border-red-400" : ""}`}
                  />
                  {fieldErrors.vehiculoId && (
                    <span className="text-xs font-medium text-red-600">
                      {fieldErrors.vehiculoId}
                    </span>
                  )}
                </label>

                <label className="flex flex-col gap-1">
                  <span className={LABEL_CLASS}>
                    Fecha de intervención <span className="text-red-500">*</span>
                  </span>
                  <input
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    className={`${INPUT_CLASS} ${fieldErrors.fecha ? "border-red-400" : ""}`}
                  />
                  {fieldErrors.fecha && (
                    <span className="text-xs font-medium text-red-600">
                      {fieldErrors.fecha}
                    </span>
                  )}
                </label>
              </div>

              <div className="flex flex-col gap-1">
                <span className={LABEL_CLASS}>
                  Tipo <span className="text-red-500">*</span>
                </span>
                <TipoIntervencionSelect
                  value={tipos}
                  onChange={setTipos}
                  error={fieldErrors.tipos}
                />
                {fieldErrors.tipos && (
                  <span className="text-xs font-medium text-red-600">
                    {fieldErrors.tipos}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <label className="flex flex-col gap-1">
                  <span className={LABEL_CLASS}>Km al momento</span>
                  <input
                    type="number"
                    min="0"
                    value={km}
                    onChange={(e) => {
                      setKm(e.target.value);
                      setKmTocadoManualmente(true);
                    }}
                    placeholder="Ej. 120000"
                    className={`${INPUT_CLASS} ${fieldErrors.km ? "border-red-400" : ""}`}
                  />
                  {fieldErrors.km && (
                    <span className="text-xs font-medium text-red-600">
                      {fieldErrors.km}
                    </span>
                  )}
                </label>

                <label className="flex flex-col gap-1">
                  <span className={LABEL_CLASS}>Próximo km</span>
                  <input
                    type="number"
                    min="0"
                    value={proximoKm}
                    onChange={(e) => setProximoKm(e.target.value)}
                    placeholder="Ej. 130000"
                    className={`${INPUT_CLASS} ${fieldErrors.proximoKm ? "border-red-400" : ""}`}
                  />
                  {fieldErrors.proximoKm && (
                    <span className="text-xs font-medium text-red-600">
                      {fieldErrors.proximoKm}
                    </span>
                  )}
                </label>

                <label className="flex flex-col gap-1">
                  <span className={LABEL_CLASS}>Fecha de vencimiento</span>
                  <input
                    type="date"
                    value={proximaFecha}
                    onChange={(e) => setProximaFecha(e.target.value)}
                    className={INPUT_CLASS}
                  />
                </label>
              </div>

              <label className="flex flex-col gap-1">
                <span className={LABEL_CLASS}>
                  Descripción{" "}
                  {tipos.includes("otro") && (
                    <span className="text-red-500">*</span>
                  )}
                </span>
                <textarea
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  rows={3}
                  className={`border px-2 py-2 text-sm ${fieldErrors.descripcion ? "border-red-400" : "border-black/15"}`}
                />
                {fieldErrors.descripcion && (
                  <span className="text-xs font-medium text-red-600">
                    {fieldErrors.descripcion}
                  </span>
                )}
              </label>
            </>
          )}
        </div>

        {error && (
          <p className="mx-5 mb-3 text-sm text-red-800 bg-red-50 border border-red-200 rounded px-2 py-1">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-black/10 px-5 py-4">
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="h-9 px-3 text-xs uppercase tracking-wider border border-black/20 bg-white hover:bg-vialto-mist disabled:opacity-50"
          >
            {readOnly ? "Cerrar" : "Cancelar"}
          </button>
          {readOnly ? (
            onEdit ? (
              <button
                type="button"
                onClick={onEdit}
                className="h-9 px-3 text-xs uppercase tracking-wider bg-vialto-charcoal text-white hover:bg-vialto-graphite"
              >
                Editar
              </button>
            ) : null
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={() => void submit()}
              className="inline-flex items-center gap-2 h-9 px-3 text-xs uppercase tracking-wider bg-vialto-charcoal text-white hover:bg-vialto-graphite disabled:opacity-50"
            >
              {saving && <Spinner className="h-3.5 w-3.5" />}
              {saving ? "Guardando…" : "Guardar"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
