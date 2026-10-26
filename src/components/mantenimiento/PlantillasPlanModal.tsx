import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { ErrorPieModal } from "@/components/shared/ErrorPieModal";
import { Spinner } from "@/components/ui/Spinner";
import { ViewModalShell, viewModalBtnGhost, viewModalBtnPrimary } from "@/components/ui/ViewModalShell";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { mantUrl } from "@/lib/mantenimientoApi";
import { CATEGORIA_PLAN_LABELS, fmtAviso, fmtIntervalo, fmtTareas } from "@/lib/mantenimientoLabels";
import { useToast } from "@/lib/toast";
import type { PlanMantenimiento, PlantillaPlan } from "@/types/mantenimiento";

/**
 * Vista previa de los planes sugeridos (`GET planes/plantillas`): se cargan de a uno o todos
 * los que falten (`POST planes/plantillas` con `nombres`). Cada carga es inmediata, así que
 * no hay nada que descartar al cerrar.
 */
export function PlantillasPlanModal({
  getToken,
  tenantId,
  onClose,
  onCargados,
}: {
  getToken: () => Promise<string | null>;
  tenantId?: string;
  onClose: () => void;
  onCargados: () => void;
}) {
  const { showToast } = useToast();
  const [plantillas, setPlantillas] = useState<PlantillaPlan[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Nombre de la plantilla que se está cargando, o "*" para "Cargar todos". */
  const [cargando, setCargando] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    apiJson<PlantillaPlan[]>(mantUrl("planes/plantillas", tenantId), () => getToken())
      .then((data) => !cancelado && setPlantillas(data))
      .catch((e) => {
        if (cancelado) return;
        setPlantillas([]);
        setError(friendlyError(e, "mantenimiento"));
      });
    return () => {
      cancelado = true;
    };
  }, [getToken, tenantId]);

  const faltantes = (plantillas ?? []).filter((t) => !t.yaCargada);

  async function cargar(nombres: string[], clave: string) {
    setCargando(clave);
    setError(null);
    try {
      const r = await apiJson<{ creados: PlanMantenimiento[] }>(mantUrl("planes/plantillas", tenantId), () => getToken(), {
        method: "POST",
        body: JSON.stringify({ nombres }),
      });
      setPlantillas((prev) => (prev ?? []).map((t) => (nombres.includes(t.nombre) ? { ...t, yaCargada: true } : t)));
      const n = r.creados.length;
      showToast(
        n === 1 ? `Se cargó "${r.creados[0].nombre}". Asignalo a tus vehículos.` : `Se cargaron ${n} planes. Asignalos a tus vehículos.`,
        "success",
      );
      onCargados();
    } catch (e) {
      setError(friendlyError(e, "mantenimiento"));
    } finally {
      setCargando(null);
    }
  }

  const footer = (
    <>
      <ErrorPieModal error={error} />
      <button type="button" onClick={onClose} className={viewModalBtnGhost}>
        Cerrar
      </button>
      <button
        type="button"
        disabled={!!cargando || faltantes.length === 0}
        onClick={() => void cargar(faltantes.map((t) => t.nombre), "*")}
        className={viewModalBtnPrimary}
      >
        {cargando === "*" && <Spinner className="mr-2 h-3.5 w-3.5" />}
        {faltantes.length ? `Cargar todos (${faltantes.length})` : "Ya están todos cargados"}
      </button>
    </>
  );

  return (
    <ViewModalShell title="Planes sugeridos" onClose={onClose} footer={footer} maxWidthClass="sm:max-w-4xl" scrollBody>
      <p className="mb-4 text-sm text-vialto-steel">
        Planes habituales para flotas de transporte. Cargá los que te sirvan; después los podés editar y los asignás a tus
        vehículos.
      </p>
      {plantillas === null ? (
        <p className="text-sm text-vialto-steel">Cargando…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/10 text-left text-[10px] uppercase tracking-[0.12em] text-vialto-steel">
                <th className="py-1.5 pr-3 font-semibold">Plan</th>
                <th className="py-1.5 pr-3 font-semibold">Intervalo</th>
                <th className="py-1.5 pr-3 font-semibold">Aviso</th>
                <th className="py-1.5 pr-3 font-semibold">Tareas</th>
                <th className="py-1.5 text-right font-semibold" />
              </tr>
            </thead>
            <tbody>
              {plantillas.map((t) => (
                <tr key={t.nombre} className="border-b border-black/5 align-top">
                  <td className="py-2 pr-3">
                    {t.nombre}
                    <span className="block text-xs text-vialto-steel">{CATEGORIA_PLAN_LABELS[t.categoria] ?? t.categoria}</span>
                  </td>
                  <td className="py-2 pr-3">{fmtIntervalo(t)}</td>
                  <td className="py-2 pr-3">{fmtAviso(t)}</td>
                  <td className="py-2 pr-3 text-xs text-vialto-steel">{fmtTareas(t.tareas)}</td>
                  <td className="py-2 text-right">
                    {t.yaCargada ? (
                      <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs uppercase tracking-wider text-emerald-700">
                        <Check className="h-3.5 w-3.5" strokeWidth={2} /> Cargado
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={!!cargando}
                        onClick={() => void cargar([t.nombre], t.nombre)}
                        className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap border border-black/20 bg-white px-3 text-xs uppercase tracking-wider hover:bg-vialto-mist disabled:opacity-50"
                      >
                        {cargando === t.nombre && <Spinner className="h-3.5 w-3.5" />}
                        Cargar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ViewModalShell>
  );
}
