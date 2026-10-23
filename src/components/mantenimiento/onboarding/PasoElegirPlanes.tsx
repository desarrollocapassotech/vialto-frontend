import { useEffect, useState } from "react";
import { Check, FileText, Plus, Wrench } from "lucide-react";
import { PlanModal } from "@/components/mantenimiento/PlanModal";
import { Spinner } from "@/components/ui/Spinner";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { mantUrl } from "@/lib/mantenimientoApi";
import { fmtAviso, fmtIntervalo } from "@/lib/mantenimientoLabels";
import type { CategoriaPlan, PlanMantenimiento, PlantillaPlan } from "@/types/mantenimiento";
import { BTN_CONTINUAR } from "./onboardingEstilos";

const norm = (s: string) => s.trim().toLowerCase();

type Opcion = {
  clave: string;
  nombre: string;
  categoria: CategoriaPlan;
  intervaloKm: number | null;
  intervaloDias: number | null;
  avisoKm: number | null;
  avisoDias: number | null;
  /** Plan propio creado en este paso (ya existe). */
  propio?: PlanMantenimiento;
};

/** Paso 1: elegir qué controlar (planes sugeridos + propios). */
export function PasoElegirPlanes({
  getToken,
  tenantId,
  onContinuar,
}: {
  getToken: () => Promise<string | null>;
  tenantId?: string;
  onContinuar: (planes: PlanMantenimiento[]) => void;
}) {
  const [opciones, setOpciones] = useState<Opcion[] | null>(null);
  const [elegidos, setElegidos] = useState<Set<string>>(new Set());
  const [creando, setCreando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    apiJson<PlantillaPlan[]>(mantUrl("planes/plantillas", tenantId), () => getToken())
      .then((data) => {
        if (cancelado) return;
        // Sin nada marcado: elige el usuario.
        setOpciones(data.map((t) => ({ ...t, clave: t.nombre })));
      })
      .catch((e) => {
        if (cancelado) return;
        setOpciones([]);
        setError(friendlyError(e, "mantenimiento"));
      });
    return () => {
      cancelado = true;
    };
  }, [getToken, tenantId]);

  function alternar(clave: string) {
    setError(null);
    setElegidos((prev) => {
      const next = new Set(prev);
      if (next.has(clave)) next.delete(clave);
      else next.add(clave);
      return next;
    });
  }

  async function continuar() {
    const lista = (opciones ?? []).filter((o) => elegidos.has(o.clave));
    if (lista.length === 0) {
      setError("Elegí al menos uno para seguir.");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const sugeridos = lista.filter((o) => !o.propio).map((o) => o.nombre);
      if (sugeridos.length) {
        await apiJson(mantUrl("planes/plantillas", tenantId), () => getToken(), {
          method: "POST",
          body: JSON.stringify({ nombres: sugeridos }),
        });
      }
      // Se releen todos para tomar también los que ya existían (si volvió a este paso).
      const todos = await apiJson<PlanMantenimiento[]>(mantUrl("planes", tenantId), () => getToken());
      const nombres = new Set(sugeridos.map(norm));
      const propios = new Set(lista.filter((o) => o.propio).map((o) => o.propio!.id));
      onContinuar(todos.filter((p) => p.activo && (nombres.has(norm(p.nombre)) || propios.has(p.id))));
    } catch (e) {
      setError(friendlyError(e, "mantenimiento"));
    } finally {
      setGuardando(false);
    }
  }

  if (opciones === null) return <p className="text-sm text-vialto-steel">Cargando…</p>;

  const grupos: { titulo: string; icon: typeof Wrench; items: Opcion[] }[] = [
    { titulo: "Mantenimiento mecánico", icon: Wrench, items: opciones.filter((o) => o.categoria === "mecanico") },
    { titulo: "Documentación", icon: FileText, items: opciones.filter((o) => o.categoria === "documental") },
  ];

  return (
    <div className="grid gap-6">
      {grupos.map((g) => (
        <div key={g.titulo} className="grid gap-2">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-vialto-steel">
            <g.icon className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
            {g.titulo}
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {g.items.map((o) => {
              const sel = elegidos.has(o.clave);
              const aviso = fmtAviso(o);
              return (
                <button
                  key={o.clave}
                  type="button"
                  onClick={() => alternar(o.clave)}
                  aria-pressed={sel}
                  className={`flex items-start gap-3 border p-3 text-left transition-colors ${
                    sel ? "border-vialto-fire bg-orange-50/60" : "border-black/15 bg-white hover:border-black/30"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border ${
                      sel ? "border-vialto-fire bg-vialto-fire text-white" : "border-black/25 bg-white"
                    }`}
                  >
                    {sel && <Check className="h-3.5 w-3.5" strokeWidth={2.5} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-vialto-charcoal">
                      {o.nombre}
                      {o.propio && <span className="ml-1 text-xs font-normal text-vialto-steel">(propio)</span>}
                    </span>
                    <span className="block text-xs text-vialto-steel">{fmtIntervalo(o)}</span>
                    {aviso !== "—" && <span className="block text-xs text-vialto-steel">Te avisamos {aviso}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={() => setCreando(true)}
        className="group flex items-center gap-4 border-2 border-dashed border-vialto-fire/50 bg-white p-4 text-left transition-colors hover:border-vialto-fire hover:bg-orange-50/60"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-vialto-fire text-white transition-transform group-hover:scale-105">
          <Plus className="h-5 w-5" strokeWidth={2.5} aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-vialto-charcoal">¿No está lo que necesitás? Creá un plan propio</span>
          <span className="block text-xs text-vialto-steel">
            Por ejemplo: cambio de cubiertas cada 60.000 km, o el vencimiento de una habilitación cada 2 años.
          </span>
        </span>
      </button>

      <div className="flex flex-wrap items-center justify-end gap-4 border-t border-black/10 pt-4">
        {error ? (
          <p className="text-sm font-medium text-red-600">{error}</p>
        ) : (
          <p className="text-xs text-vialto-steel">Después los podés editar o agregar más desde la pestaña Planes.</p>
        )}
        <button type="button" disabled={guardando} onClick={() => void continuar()} className={BTN_CONTINUAR}>
          {guardando && <Spinner className="h-4 w-4" />}
          Continuar
        </button>
      </div>

      {creando && (
        <PlanModal
          estado={{ modo: "crear" }}
          soloLectura={false}
          getToken={getToken}
          tenantId={tenantId}
          onClose={() => setCreando(false)}
          onGuardado={(plan) => {
            setOpciones((prev) => [...(prev ?? []), { ...plan, clave: plan.id, propio: plan }]);
            setElegidos((prev) => new Set(prev).add(plan.id));
          }}
        />
      )}
    </div>
  );
}
