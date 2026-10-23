import { useEffect, useRef, useState } from "react";
import { AsignarPlanRapido } from "@/components/mantenimiento/AsignarPlanRapido";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { mantUrl } from "@/lib/mantenimientoApi";
import { CATEGORIA_PLAN_LABELS } from "@/lib/mantenimientoLabels";
import type { VehiculoPlanAsignado } from "@/types/mantenimiento";

/**
 * "Planes que cumple" una OT: los planes asignados a la unidad elegida
 * (`GET mantenimiento/vehiculos/:id/planes`). Se muestran los activos más los que ya estaban
 * tildados (una OT vieja puede cumplir un plan que después se desactivó). Un admin puede
 * asignarle un plan al vehículo desde acá ("+ Asignar plan"), que queda tildado.
 */
export function PlanesCumpleCheckboxes({
  vehiculoId,
  vehiculoTipo,
  value,
  onChange,
  onPlanesCargados,
  onAsignado,
  soloLectura = false,
  getToken,
  tenantId,
}: {
  vehiculoId: string;
  /** Para ofrecer solo planes de su tipo (o de cualquiera) en la asignación rápida. */
  vehiculoTipo?: string;
  value: string[];
  onChange: (next: string[]) => void;
  /** Avisa los planes de la unidad (el modal los usa para sugerir tareas). */
  onPlanesCargados?: (planes: VehiculoPlanAsignado[]) => void;
  /** Se asignó un plan desde acá: el padre lo tilda (y suma sus tareas). */
  onAsignado?: (asignacion: VehiculoPlanAsignado) => void;
  soloLectura?: boolean;
  getToken: () => Promise<string | null>;
  tenantId?: string;
}) {
  const [planes, setPlanes] = useState<VehiculoPlanAsignado[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [asignando, setAsignando] = useState(false);
  const [recarga, setRecarga] = useState(0);
  /** Asignación recién creada: al recargar la lista se avisa al padre con sus datos completos. */
  const pendienteRef = useRef<string | null>(null);
  const vehiculoCargadoRef = useRef<string | null>(null);
  const onAsignadoRef = useRef(onAsignado);
  onAsignadoRef.current = onAsignado;

  useEffect(() => {
    setAsignando(false);
  }, [vehiculoId]);

  useEffect(() => {
    if (!vehiculoId) {
      setPlanes([]);
      return;
    }
    let cancelado = false;
    // Al cambiar de vehículo, "Cargando…"; al recargar tras asignar, se mantiene la lista.
    if (vehiculoCargadoRef.current !== vehiculoId) setPlanes(null);
    vehiculoCargadoRef.current = vehiculoId;
    setError(null);
    apiJson<VehiculoPlanAsignado[]>(mantUrl(`vehiculos/${encodeURIComponent(vehiculoId)}/planes`, tenantId), () => getToken())
      .then((data) => {
        if (cancelado) return;
        setPlanes(data);
        onPlanesCargados?.(data);
        const nuevo = data.find((p) => p.id === pendienteRef.current);
        pendienteRef.current = null;
        if (nuevo) onAsignadoRef.current?.(nuevo);
      })
      .catch((e) => {
        if (!cancelado) {
          setPlanes([]);
          setError(friendlyError(e, "mantenimiento"));
        }
      });
    return () => {
      cancelado = true;
    };
    // onPlanesCargados se omite a propósito: solo importa cuando cambia la unidad.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehiculoId, tenantId, getToken, recarga]);

  if (!vehiculoId) return <p className="text-sm text-vialto-steel">Elegí el vehículo para ver sus planes.</p>;
  if (planes === null) return <p className="text-sm text-vialto-steel">Cargando planes…</p>;
  if (error) return <p className="text-xs font-medium text-red-600">{error}</p>;

  const visibles = planes.filter((p) => (p.activo && p.plan.activo) || value.includes(p.id));

  return (
    <div className="grid gap-2">
      {visibles.length === 0 ? (
        <p className="text-sm text-vialto-steel">El vehículo no tiene planes asignados.</p>
      ) : (
        <div className="grid gap-1.5 sm:grid-cols-2">
          {visibles.map((p) => (
            <label key={p.id} className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-vialto-charcoal"
                checked={value.includes(p.id)}
                onChange={(e) =>
                  onChange(e.target.checked ? [...value, p.id] : value.filter((id) => id !== p.id))
                }
              />
              <span>
                {p.plan.nombre}
                <span className="ml-1 text-xs text-vialto-steel">({CATEGORIA_PLAN_LABELS[p.plan.categoria] ?? p.plan.categoria})</span>
              </span>
            </label>
          ))}
        </div>
      )}
      {!soloLectura &&
        (asignando ? (
          <AsignarPlanRapido
            vehiculoId={vehiculoId}
            vehiculoTipo={vehiculoTipo}
            planesAsignados={planes.filter((p) => p.activo).map((p) => p.planId)}
            getToken={getToken}
            tenantId={tenantId}
            onAsignado={(vehiculoPlanId) => {
              pendienteRef.current = vehiculoPlanId;
              setAsignando(false);
              setRecarga((n) => n + 1);
            }}
            onCancelar={() => {
              setAsignando(false);
              setRecarga((n) => n + 1);
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAsignando(true)}
            className="justify-self-start text-xs font-medium uppercase tracking-wider text-vialto-fire hover:underline"
          >
            + Asignar plan al vehículo
          </button>
        ))}
    </div>
  );
}
