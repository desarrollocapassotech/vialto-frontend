import { useState } from "react";
import { useToast } from "@/lib/toast";
import type { Vehiculo } from "@/types/api";

type EstadoChecklist = "ok" | "novedad" | "incidente";

const ESTADO_LABELS: Record<EstadoChecklist, string> = {
  ok: "Sin novedad",
  novedad: "Con novedad",
  incidente: "Incidente",
};

const ESTADO_CLASSES: Record<EstadoChecklist, string> = {
  ok: "border-emerald-300 bg-emerald-50 text-emerald-800",
  novedad: "border-amber-300 bg-amber-50 text-amber-800",
  incidente: "border-red-300 bg-red-50 text-red-800",
};

type Borrador = { estado: EstadoChecklist; notas: string };

export function MantenimientoChecklistSection({
  vehiculos,
}: {
  vehiculos: Vehiculo[];
}) {
  const { showToast } = useToast();
  const [borradores, setBorradores] = useState<Record<string, Borrador>>({});

  function getBorrador(vehiculoId: string): Borrador {
    return borradores[vehiculoId] ?? { estado: "ok", notas: "" };
  }

  function setBorrador(vehiculoId: string, patch: Partial<Borrador>) {
    setBorradores((prev) => ({
      ...prev,
      [vehiculoId]: { ...getBorrador(vehiculoId), ...patch },
    }));
  }

  const activos = vehiculos.filter((v) => v.activo);

  return (
    <div>
      <div className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p className="font-medium">Vista previa — todavía no se guarda</p>
        <p className="mt-1 text-amber-900/90">
          El checklist diario del chofer es la visión original del módulo
          (documento funcional, sección 4 — Flujo C), pensada para vivir en
          Firestore en tiempo real. Todavía no está implementado: lo que ves
          acá es solo para mostrar el concepto en una demo, no persiste datos.
        </p>
      </div>

      {activos.length === 0 ? (
        <p className="mt-6 text-sm text-vialto-steel border border-black/10 bg-vialto-mist/40 px-4 py-6 text-center">
          No hay vehículos activos para mostrar en el checklist.
        </p>
      ) : (
        <div className="mt-6 grid gap-3">
          {activos.map((v) => {
            const borrador = getBorrador(v.id);
            return (
              <div key={v.id} className="border border-black/10 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-vialto-charcoal">
                    {v.patente}
                  </span>
                  <div className="flex gap-1.5">
                    {(Object.keys(ESTADO_LABELS) as EstadoChecklist[]).map(
                      (estado) => (
                        <button
                          key={estado}
                          type="button"
                          onClick={() => setBorrador(v.id, { estado })}
                          className={`text-[10px] uppercase tracking-wider px-2 py-1 border ${
                            borrador.estado === estado
                              ? ESTADO_CLASSES[estado]
                              : "border-black/15 text-vialto-steel hover:bg-vialto-mist"
                          }`}
                        >
                          {ESTADO_LABELS[estado]}
                        </button>
                      ),
                    )}
                  </div>
                </div>
                <textarea
                  value={borrador.notas}
                  onChange={(e) =>
                    setBorrador(v.id, { notas: e.target.value })
                  }
                  placeholder="Novedades o incidentes reportados por el chofer…"
                  rows={2}
                  className="mt-3 w-full border border-black/15 px-2 py-2 text-sm"
                />
              </div>
            );
          })}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() =>
                showToast(
                  "Vista previa — el checklist diario todavía no se guarda.",
                  "error",
                )
              }
              className="inline-flex h-10 items-center px-4 bg-vialto-charcoal/50 text-white text-sm uppercase tracking-wider cursor-not-allowed"
            >
              Guardar checklist del día
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
