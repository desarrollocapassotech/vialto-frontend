import { useEffect, useState } from "react";
import { SearchableEntitySelect } from "@/components/forms/SearchableEntitySelect";
import { PlanModal } from "@/components/mantenimiento/PlanModal";
import { Spinner } from "@/components/ui/Spinner";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { mantUrl } from "@/lib/mantenimientoApi";
import { CATEGORIA_PLAN_LABELS, fmtIntervalo } from "@/lib/mantenimientoLabels";
import type { PlanMantenimiento, ResultadoAsignacion } from "@/types/mantenimiento";

function filtrarPlanes(planes: PlanMantenimiento[], q: string): PlanMantenimiento[] {
  const s = q.trim().toLowerCase();
  if (!s) return planes;
  return planes.filter((p) => p.nombre.toLowerCase().includes(s));
}

/**
 * Alta rápida de un plan en el vehículo de una OT: elegir un plan activo (o crearlo) y
 * asignarlo sin último service — la OT que se está cargando pasa a ser la referencia.
 * Mismo formato que el alta rápida de `TallerSelect`.
 */
export function AsignarPlanRapido({
  vehiculoId,
  vehiculoTipo,
  planesAsignados,
  getToken,
  tenantId,
  onAsignado,
  onCancelar,
}: {
  vehiculoId: string;
  vehiculoTipo?: string;
  /** Planes que el vehículo ya tiene activos (no se ofrecen). */
  planesAsignados: string[];
  getToken: () => Promise<string | null>;
  tenantId?: string;
  onAsignado: (vehiculoPlanId: string) => void;
  onCancelar: () => void;
}) {
  const [planes, setPlanes] = useState<PlanMantenimiento[] | null>(null);
  const [planId, setPlanId] = useState("");
  const [creando, setCreando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    apiJson<PlanMantenimiento[]>(mantUrl("planes", tenantId, { activo: "true" }), () => getToken())
      .then((data) => !cancelado && setPlanes(data))
      .catch((e) => {
        if (cancelado) return;
        setPlanes([]);
        setError(friendlyError(e, "mantenimiento"));
      });
    return () => {
      cancelado = true;
    };
  }, [getToken, tenantId]);

  const opciones = (planes ?? []).filter(
    (p) =>
      p.activo &&
      !planesAsignados.includes(p.id) &&
      (!p.tipoVehiculo || !vehiculoTipo || p.tipoVehiculo === vehiculoTipo),
  );

  async function asignar() {
    if (!planId) {
      setError("Elegí el plan.");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const r = await apiJson<ResultadoAsignacion>(
        mantUrl(`planes/${encodeURIComponent(planId)}/vehiculos`, tenantId),
        () => getToken(),
        { method: "POST", body: JSON.stringify({ vehiculoIds: [vehiculoId] }) },
      );
      const vp = r.creados[0] ?? r.reactivados[0];
      if (vp) onAsignado(vp.id);
      else onCancelar(); // ya lo tenía (otra pestaña): la lista se recarga igual
    } catch (e) {
      setError(friendlyError(e, "mantenimiento"));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="grid gap-1">
      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <SearchableEntitySelect<PlanMantenimiento>
            items={opciones}
            value={planId}
            onChange={setPlanId}
            filterItems={filtrarPlanes}
            getPrimaryLabel={(p) => p.nombre}
            getSecondaryLabel={(p) => `${CATEGORIA_PLAN_LABELS[p.categoria] ?? p.categoria} · ${fmtIntervalo(p)}`}
            placeholderCerrado={planes === null ? "Cargando planes…" : opciones.length ? "Elegí el plan…" : "No hay planes para asignar"}
            placeholderBuscar="Buscar plan…"
            searchAriaLabel="Filtrar planes"
            aria-label="Plan a asignar"
            disabled={planes === null}
            onNuevo={() => setCreando(true)}
            onNuevoLabel="+ Nuevo plan"
            inputClassName={`h-10 w-full border bg-white px-3 text-sm ${error ? "border-red-400" : "border-black/15"}`}
          />
        </div>
        <button
          type="button"
          disabled={guardando || !planId}
          onClick={() => void asignar()}
          className="inline-flex h-10 items-center gap-1.5 bg-vialto-charcoal px-3 text-xs uppercase tracking-wider text-white hover:bg-vialto-graphite disabled:opacity-50"
        >
          {guardando && <Spinner className="h-3.5 w-3.5" />}
          Asignar
        </button>
        <button
          type="button"
          disabled={guardando}
          onClick={onCancelar}
          className="h-10 border border-black/20 px-3 text-xs uppercase tracking-wider hover:bg-vialto-mist"
        >
          Cancelar
        </button>
      </div>
      {error && <span className="text-xs font-medium text-red-600">{error}</span>}
      {creando && (
        <PlanModal
          estado={{ modo: "crear" }}
          soloLectura={false}
          getToken={getToken}
          tenantId={tenantId}
          onClose={() => setCreando(false)}
          onGuardado={(plan) => {
            setPlanes((prev) => [...(prev ?? []), plan]);
            setPlanId(plan.id);
          }}
        />
      )}
    </div>
  );
}
