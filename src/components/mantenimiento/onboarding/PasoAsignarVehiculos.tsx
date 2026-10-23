import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Spinner } from "@/components/ui/Spinner";
import { useMaestroData } from "@/hooks/useMaestroData";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { mantUrl } from "@/lib/mantenimientoApi";
import { fmtIntervalo } from "@/lib/mantenimientoLabels";
import { compararAlfabetico } from "@/lib/ordenAlfabetico";
import type { PlanMantenimiento } from "@/types/mantenimiento";
import { BTN_CONTINUAR, BTN_VOLVER } from "./onboardingEstilos";
import { ElegirVehiculosModal } from "./ElegirVehiculosModal";

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Paso 2: a qué vehículos se aplica cada plan elegido. */
export function PasoAsignarVehiculos({
  planes,
  getToken,
  tenantId,
  onVolver,
  onContinuar,
}: {
  planes: PlanMantenimiento[];
  getToken: () => Promise<string | null>;
  tenantId?: string;
  onVolver: () => void;
  onContinuar: (resumen: { planes: number; vehiculos: number }) => void;
}) {
  const maestro = useMaestroData();
  const vehiculos = useMemo(
    () => maestro.vehiculos.filter((v) => v.activo).sort((a, b) => compararAlfabetico(a.patente, b.patente)),
    [maestro.vehiculos],
  );

  /** Vehículos elegidos por plan. */
  const [elecciones, setElecciones] = useState<Record<string, Set<string>>>({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [eligiendo, setEligiendo] = useState<PlanMantenimiento | null>(null);

  // Documentación: a todos por defecto. Mecánicos: sin elegir (o los del tipo del plan, si tiene).
  useEffect(() => {
    if (maestro.loading) return;
    setElecciones((prev) => {
      const next: Record<string, Set<string>> = {};
      for (const p of planes) {
        next[p.id] =
          prev[p.id] ??
          new Set(
            vehiculos
              .filter((v) => (p.tipoVehiculo ? v.tipo === p.tipoVehiculo : p.categoria === "documental"))
              .map((v) => v.id),
          );
      }
      return next;
    });
  }, [planes, vehiculos, maestro.loading]);

  function elegir(planId: string, ids: Set<string>) {
    setElecciones((prev) => ({ ...prev, [planId]: ids }));
  }

  const sinVehiculos = planes.filter((p) => (elecciones[p.id]?.size ?? 0) === 0);

  async function continuar() {
    setGuardando(true);
    setError(null);
    try {
      const conVehiculos = planes.filter((p) => (elecciones[p.id]?.size ?? 0) > 0);
      // Sin último service: el ciclo arranca con la primera orden de trabajo que cumpla el plan.
      for (const p of conVehiculos) {
        await apiJson(mantUrl(`planes/${encodeURIComponent(p.id)}/vehiculos`, tenantId), () => getToken(), {
          method: "POST",
          body: JSON.stringify({ vehiculoIds: [...elecciones[p.id]] }),
        });
      }
      const distintos = new Set(conVehiculos.flatMap((p) => [...elecciones[p.id]]));
      onContinuar({ planes: conVehiculos.length, vehiculos: distintos.size });
    } catch (e) {
      setError(friendlyError(e, "mantenimiento"));
    } finally {
      setGuardando(false);
    }
  }

  const pie = (
    <div className="flex flex-wrap items-center justify-end gap-4 border-t border-black/10 pt-4">
      <button type="button" disabled={guardando} onClick={onVolver} className={`${BTN_VOLVER} mr-auto`}>
        Volver
      </button>
      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      <button
        type="button"
        disabled={guardando}
        onClick={() => (sinVehiculos.length > 0 ? setConfirmando(true) : void continuar())}
        className={BTN_CONTINUAR}
      >
        {guardando && <Spinner className="h-4 w-4" />}
        Continuar
      </button>
    </div>
  );

  if (maestro.loading) return <p className="text-sm text-vialto-steel">Cargando vehículos…</p>;

  if (vehiculos.length === 0) {
    return (
      <div className="grid gap-6">
        <div>
          <h2 className="text-lg font-medium text-vialto-charcoal">¿A qué vehículos se aplica cada uno?</h2>
          <p className="mt-2 text-sm text-vialto-steel">
            Todavía no tenés vehículos cargados.{" "}
            <Link to="/base-de-datos?tab=vehiculos" className="font-medium text-vialto-fire hover:underline">
              Cargalos en Base de datos → Vehículos
            </Link>{" "}
            y después asignales los planes desde la pestaña Planes.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-4 border-t border-black/10 pt-4">
          <button type="button" onClick={onVolver} className={`${BTN_VOLVER} mr-auto`}>
            Volver
          </button>
          <button type="button" onClick={() => onContinuar({ planes: 0, vehiculos: 0 })} className={BTN_CONTINUAR}>
            Continuar igual
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div>
        <h2 className="text-lg font-medium text-vialto-charcoal">¿A qué vehículos se aplica cada uno?</h2>
      </div>

      <div className="divide-y divide-black/10 border border-black/15 bg-white">
        {planes.map((p) => {
          const e = elecciones[p.id];
          if (!e) return null;
          const modo = e.size === 0 ? "ninguno" : e.size === vehiculos.length ? "todos" : "elegidos";
          return (
            <div key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <p className="min-w-0 flex-1 text-sm font-medium text-vialto-charcoal">
                {p.nombre}
                <span className="block text-xs font-normal text-vialto-steel">{fmtIntervalo(p)}</span>
              </p>
              <div className="flex items-center gap-3">
                <span className="text-xs text-vialto-steel">Se aplica a</span>
                <select
                  value={modo}
                  onChange={(ev) => {
                    const v = ev.target.value;
                    if (v === "todos") elegir(p.id, new Set(vehiculos.map((x) => x.id)));
                    else if (v === "ninguno") elegir(p.id, new Set());
                    else if (v === "elegir") setEligiendo(p);
                  }}
                  aria-label={`Vehículos de ${p.nombre}`}
                  className={`h-10 w-60 border bg-white px-3 text-sm ${modo === "ninguno" ? "border-amber-300 text-amber-800" : "border-black/15"}`}
                >
                  <option value="todos">Todos los vehículos ({vehiculos.length})</option>
                  {modo === "elegidos" && <option value="elegidos">{plural(e.size, "vehículo elegido", "vehículos elegidos")}</option>}
                  <option value="ninguno">Ninguno por ahora</option>
                  <option value="elegir">Elegir vehículos…</option>
                </select>
                {modo === "elegidos" && (
                  <button
                    type="button"
                    onClick={() => setEligiendo(p)}
                    className="text-xs text-vialto-steel hover:text-vialto-charcoal hover:underline"
                  >
                    Cambiar
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {eligiendo && (
        <ElegirVehiculosModal
          titulo={`Vehículos de "${eligiendo.nombre}"`}
          vehiculos={vehiculos}
          inicial={elecciones[eligiendo.id] ?? new Set()}
          onAceptar={(ids) => elegir(eligiendo.id, ids)}
          onClose={() => setEligiendo(null)}
        />
      )}

      {pie}

      <ConfirmDialog
        open={confirmando}
        title={sinVehiculos.length === 1 ? "Un plan queda sin vehículos" : `${sinVehiculos.length} planes quedan sin vehículos`}
        message="Los podés asignar después desde la pestaña Planes. ¿Seguir igual?"
        confirmLabel="Seguir igual"
        cancelLabel="Elegir vehículos"
        onConfirm={() => {
          setConfirmando(false);
          void continuar();
        }}
        onCancel={() => setConfirmando(false)}
      />
    </div>
  );
}
