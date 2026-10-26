import { useEffect, useMemo, useState } from "react";
import { ErrorPieModal } from "@/components/shared/ErrorPieModal";
import { FechaPicker } from "@/components/mantenimiento/FechaPicker";
import { Spinner } from "@/components/ui/Spinner";
import { ViewModalShell, viewModalBtnGhost, viewModalBtnPrimary } from "@/components/ui/ViewModalShell";
import { useConfirmarDescarte } from "@/hooks/useConfirmarDescarte";
import { useMaestroData } from "@/hooks/useMaestroData";
import { apiJson } from "@/lib/api";
import { marcarModalModificado } from "@/lib/descarteModal";
import { hoyArgentinaIso } from "@/lib/facturaFechaEmision";
import { friendlyError } from "@/lib/friendlyError";
import { mantUrl } from "@/lib/mantenimientoApi";
import { fmtIntervalo, fmtKm } from "@/lib/mantenimientoLabels";
import { compararAlfabetico } from "@/lib/ordenAlfabetico";
import { useToast } from "@/lib/toast";
import { labelTipoVehiculo } from "@/lib/vehiculoTipos";
import type { Vehiculo } from "@/types/api";
import type { AsignacionPlan, PlanMantenimiento, ResultadoAsignacion } from "@/types/mantenimiento";

type Fila = { sel: boolean; fecha: string; km: string };

const INPUT = "h-10 w-full border bg-white px-3 text-sm";
const soloDigitos = (s: string) => s.replace(/\D/g, "");

/**
 * Asignar un plan a varios vehículos con su último service (el "alta rápida" del onboarding).
 * Vienen tildados los del tipo del plan; los que ya lo tienen activo no se pueden tildar.
 * Un solo request (`POST planes/:id/vehiculos` con base por vehículo).
 */
export function AsignarVehiculosModal({
  plan,
  getToken,
  tenantId,
  onClose,
  onAsignado,
}: {
  plan: PlanMantenimiento;
  getToken: () => Promise<string | null>;
  tenantId?: string;
  onClose: () => void;
  onAsignado: () => void;
}) {
  const { showToast } = useToast();
  const maestro = useMaestroData();
  const descarte = useConfirmarDescarte(onClose);

  const [asignados, setAsignados] = useState<Set<string> | null>(null);
  const [filas, setFilas] = useState<Record<string, Fila>>({});
  const [busqueda, setBusqueda] = useState("");
  const [fechaTodos, setFechaTodos] = useState("");
  const [kmTodos, setKmTodos] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const compatible = (v: Vehiculo) => !plan.tipoVehiculo || v.tipo === plan.tipoVehiculo;

  // Activos primero los del tipo del plan, después por patente.
  const vehiculos = useMemo(
    () =>
      maestro.vehiculos
        .filter((v) => v.activo)
        .sort((a, b) => Number(compatible(b)) - Number(compatible(a)) || compararAlfabetico(a.patente, b.patente)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [maestro.vehiculos, plan.tipoVehiculo],
  );

  useEffect(() => {
    let cancelado = false;
    apiJson<AsignacionPlan[]>(mantUrl(`planes/${encodeURIComponent(plan.id)}/vehiculos`, tenantId), () => getToken())
      .then((data) => !cancelado && setAsignados(new Set(data.filter((a) => a.activo).map((a) => a.vehiculoId))))
      .catch((e) => {
        if (cancelado) return;
        setAsignados(new Set());
        setError(friendlyError(e, "mantenimiento"));
      });
    return () => {
      cancelado = true;
    };
  }, [plan.id, tenantId, getToken]);

  // Preselección: los del tipo del plan que todavía no lo tienen (si el plan es para cualquier tipo, ninguno).
  useEffect(() => {
    if (!asignados) return;
    setFilas((prev) => {
      const next = { ...prev };
      for (const v of vehiculos) {
        if (next[v.id]) continue;
        next[v.id] = { sel: !!plan.tipoVehiculo && compatible(v) && !asignados.has(v.id), fecha: "", km: "" };
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asignados, vehiculos, plan.tipoVehiculo]);

  const q = busqueda.trim().toLowerCase();
  const visibles = q
    ? vehiculos.filter((v) => [v.patente, v.marca, v.modelo].some((x) => (x ?? "").toLowerCase().includes(q)))
    : vehiculos;
  const seleccionados = vehiculos.filter((v) => filas[v.id]?.sel && !asignados?.has(v.id));

  function actualizar(id: string, cambio: Partial<Fila>) {
    setFilas((prev) => ({ ...prev, [id]: { ...(prev[id] ?? { sel: false, fecha: "", km: "" }), ...cambio } }));
  }

  function tildarVisibles(sel: boolean) {
    marcarModalModificado();
    setFilas((prev) => {
      const next = { ...prev };
      for (const v of visibles) if (!asignados?.has(v.id)) next[v.id] = { ...next[v.id], sel };
      return next;
    });
  }

  function aplicarATodos() {
    marcarModalModificado();
    setFilas((prev) => {
      const next = { ...prev };
      for (const v of seleccionados) {
        next[v.id] = { ...next[v.id], ...(fechaTodos ? { fecha: fechaTodos } : {}), ...(kmTodos ? { km: kmTodos } : {}) };
      }
      return next;
    });
  }

  async function guardar() {
    if (seleccionados.length === 0) {
      setFieldErrors({ seleccion: "Tildá al menos un vehículo." });
      return;
    }
    const hoy = hoyArgentinaIso();
    const errs: Record<string, string> = {};
    for (const v of seleccionados) {
      if (filas[v.id].fecha > hoy) errs[`fecha-${v.id}`] = `${v.patente}: la fecha del último service no puede ser futura.`;
    }
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setGuardando(true);
    setError(null);
    try {
      // Vacío = no se manda: en una asignación que se reactiva conserva el último service que tenía.
      const r = await apiJson<ResultadoAsignacion>(
        mantUrl(`planes/${encodeURIComponent(plan.id)}/vehiculos`, tenantId),
        () => getToken(),
        {
          method: "POST",
          body: JSON.stringify({
            vehiculos: seleccionados.map((v) => ({
              vehiculoId: v.id,
              ...(filas[v.id].fecha ? { baseFecha: filas[v.id].fecha } : {}),
              ...(filas[v.id].km ? { baseKm: Number(filas[v.id].km) } : {}),
            })),
          }),
        },
      );
      const n = r.creados.length + r.reactivados.length;
      showToast(`"${plan.nombre}" asignado a ${n} ${n === 1 ? "vehículo" : "vehículos"}`, "success");
      onAsignado();
      onClose();
    } catch (e) {
      setError(friendlyError(e, "mantenimiento"));
    } finally {
      setGuardando(false);
    }
  }

  const footer = (
    <>
      <ErrorPieModal error={error} fieldErrors={fieldErrors} />
      <button type="button" disabled={guardando} onClick={descarte.solicitarCierre} className={viewModalBtnGhost}>
        Cancelar
      </button>
      <button type="button" disabled={guardando || !asignados} onClick={() => void guardar()} className={viewModalBtnPrimary}>
        {guardando && <Spinner className="mr-2 h-3.5 w-3.5" />}
        {guardando ? "Asignando…" : "Asignar"}
      </button>
    </>
  );

  return (
    <ViewModalShell
      title={`Asignar "${plan.nombre}"`}
      onClose={descarte.solicitarCierre}
      descarte={descarte}
      footer={footer}
      maxWidthClass="sm:max-w-4xl"
      scrollBody
    >
      <div className="grid gap-4">
        <p className="text-sm text-vialto-steel">
          {fmtIntervalo(plan)}
          {plan.tipoVehiculo ? ` · para ${labelTipoVehiculo(plan.tipoVehiculo).toLowerCase()}` : ""}. Cargá el último
          service hecho de cada vehículo (fecha, km o ambos) para que el vencimiento arranque bien; si no lo sabés, dejalo
          vacío y se toma la primera orden de trabajo que cumpla el plan.
        </p>

        <div className="grid gap-2 border border-black/10 bg-vialto-mist/40 p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="grid gap-1 text-xs uppercase tracking-[0.08em] text-vialto-steel">
            Fecha para los tildados
            <FechaPicker value={fechaTodos} onChange={setFechaTodos} allowClear aria-label="Fecha para los tildados" />
          </label>
          <label className="grid gap-1 text-xs uppercase tracking-[0.08em] text-vialto-steel">
            Km para los tildados
            <input
              type="text"
              inputMode="numeric"
              value={kmTodos}
              onChange={(e) => setKmTodos(soloDigitos(e.target.value))}
              placeholder="Ej. 480000"
              className={`${INPUT} border-black/15 normal-case tracking-normal text-vialto-charcoal`}
            />
          </label>
          <button
            type="button"
            disabled={(!fechaTodos && !kmTodos) || seleccionados.length === 0}
            onClick={aplicarATodos}
            className="h-10 border border-black/20 bg-white px-3 text-xs uppercase tracking-wider hover:bg-vialto-mist disabled:opacity-50"
          >
            Aplicar
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar patente o marca…"
            aria-label="Buscar vehículos"
            data-descarte-ignorar
            className={`${INPUT} max-w-xs border-black/15`}
          />
          <button type="button" onClick={() => tildarVisibles(true)} className="text-xs uppercase tracking-wider text-vialto-steel hover:underline">
            Tildar todos
          </button>
          <button type="button" onClick={() => tildarVisibles(false)} className="text-xs uppercase tracking-wider text-vialto-steel hover:underline">
            Destildar todos
          </button>
          <span className="text-xs text-vialto-steel">
            {seleccionados.length} {seleccionados.length === 1 ? "vehículo tildado" : "vehículos tildados"}
          </span>
        </div>

        {!asignados ? (
          <p className="text-sm text-vialto-steel">Cargando…</p>
        ) : visibles.length === 0 ? (
          <p className="text-sm text-vialto-steel">No hay vehículos que coincidan.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/10 text-left text-[10px] uppercase tracking-[0.12em] text-vialto-steel">
                  <th className="w-8 py-1.5" />
                  <th className="py-1.5 pr-3 font-semibold">Vehículo</th>
                  <th className="py-1.5 pr-3 font-semibold">Km actual</th>
                  <th className="py-1.5 pr-3 font-semibold">Fecha último service</th>
                  <th className="py-1.5 font-semibold">Km último service</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((v) => {
                  const ya = asignados.has(v.id);
                  const f = filas[v.id] ?? { sel: false, fecha: "", km: "" };
                  return (
                    <tr key={v.id} className={`border-b border-black/5 ${ya ? "text-vialto-steel" : ""}`}>
                      <td className="py-1.5">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-vialto-charcoal"
                          checked={ya || f.sel}
                          disabled={ya}
                          onChange={(e) => actualizar(v.id, { sel: e.target.checked })}
                          aria-label={`Asignar a ${v.patente}`}
                        />
                      </td>
                      <td className="py-1.5 pr-3">
                        {v.patente}
                        <span className="block text-xs text-vialto-steel">
                          {labelTipoVehiculo(v.tipo)}
                          {ya && " · Ya asignado"}
                        </span>
                      </td>
                      <td className="py-1.5 pr-3 tabular-nums">{v.kmActual > 0 ? fmtKm(v.kmActual) : "—"}</td>
                      <td className="py-1.5 pr-3">
                        {!ya && f.sel && (
                          <div className="w-44">
                            <FechaPicker
                              value={f.fecha}
                              onChange={(fecha) => actualizar(v.id, { fecha })}
                              allowClear
                              error={fieldErrors[`fecha-${v.id}`]}
                              aria-label={`Fecha del último service de ${v.patente}`}
                            />
                          </div>
                        )}
                      </td>
                      <td className="py-1.5">
                        {!ya && f.sel && (
                          <input
                            type="text"
                            inputMode="numeric"
                            value={f.km}
                            onChange={(e) => actualizar(v.id, { km: soloDigitos(e.target.value) })}
                            placeholder="Km"
                            aria-label={`Km del último service de ${v.patente}`}
                            className={`${INPUT} w-32 border-black/15`}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ViewModalShell>
  );
}
