import { useEffect, useState } from "react";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { mantUrl } from "@/lib/mantenimientoApi";
import { CATEGORIA_PLAN_LABELS } from "@/lib/mantenimientoLabels";
import type { VehiculoPlanAsignado } from "@/types/mantenimiento";

/**
 * "Planes que cumple" una OT: los planes asignados a la unidad elegida
 * (`GET mantenimiento/vehiculos/:id/planes`). Se muestran los activos más los que ya estaban
 * tildados (una OT vieja puede cumplir un plan que después se desactivó).
 */
export function PlanesCumpleCheckboxes({
  vehiculoId,
  value,
  onChange,
  onPlanesCargados,
  getToken,
  tenantId,
}: {
  vehiculoId: string;
  value: string[];
  onChange: (next: string[]) => void;
  /** Avisa los planes de la unidad (el modal los usa para sugerir tareas). */
  onPlanesCargados?: (planes: VehiculoPlanAsignado[]) => void;
  getToken: () => Promise<string | null>;
  tenantId?: string;
}) {
  const [planes, setPlanes] = useState<VehiculoPlanAsignado[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!vehiculoId) {
      setPlanes([]);
      return;
    }
    let cancelado = false;
    setPlanes(null);
    setError(null);
    apiJson<VehiculoPlanAsignado[]>(mantUrl(`vehiculos/${encodeURIComponent(vehiculoId)}/planes`, tenantId), () => getToken())
      .then((data) => {
        if (cancelado) return;
        setPlanes(data);
        onPlanesCargados?.(data);
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
  }, [vehiculoId, tenantId, getToken]);

  if (!vehiculoId) return <p className="text-sm text-vialto-steel">Elegí el vehículo para ver sus planes.</p>;
  if (planes === null) return <p className="text-sm text-vialto-steel">Cargando planes…</p>;
  if (error) return <p className="text-xs font-medium text-red-600">{error}</p>;

  const visibles = planes.filter((p) => (p.activo && p.plan.activo) || value.includes(p.id));
  if (visibles.length === 0) {
    return <p className="text-sm text-vialto-steel">El vehículo no tiene planes asignados.</p>;
  }

  return (
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
  );
}
