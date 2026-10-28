import { useEffect, useState } from "react";
import { Pencil, Power, PowerOff, Trash2 } from "lucide-react";
import { FechaPicker } from "@/components/mantenimiento/FechaPicker";
import { InactivoBadge } from "@/components/mantenimiento/MantenimientoBadges";
import { AccionesFila } from "@/components/ui/AccionesFila";
import type { AccionOpcion } from "@/components/ui/AccionesOpcionesSheet";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Spinner } from "@/components/ui/Spinner";
import { VehiculoHoverCard } from "@/components/vehiculos/VehiculoHoverCard";
import { clickFilaAcciones } from "@/lib/accionesFila";
import { apiJson } from "@/lib/api";
import { hoyArgentinaIso } from "@/lib/facturaFechaEmision";
import { friendlyError } from "@/lib/friendlyError";
import { mantUrl } from "@/lib/mantenimientoApi";
import { fmtFecha, fmtKm } from "@/lib/mantenimientoLabels";
import { labelTipoVehiculo } from "@/lib/vehiculoTipos";
import { useToast } from "@/lib/toast";
import type { AsignacionPlan } from "@/types/mantenimiento";

const LINK = "text-xs uppercase tracking-wider text-vialto-steel hover:text-vialto-charcoal hover:underline disabled:opacity-50";

/**
 * Vehículos asignados a un plan (vista del plan): último service cargado al asignar,
 * corregirlo, desactivar/reactivar y quitar. Quitar una asignación que alguna OT cumplió
 * lo rechaza el backend (409) con el mensaje de desactivarla.
 */
export function AsignacionesPlanLista({
  planId,
  soloLectura,
  getToken,
  tenantId,
  reloadKey,
  onCambio,
}: {
  planId: string;
  soloLectura: boolean;
  getToken: () => Promise<string | null>;
  tenantId?: string;
  reloadKey: number;
  /** Cambió alguna asignación: el padre recarga (cantidad de vehículos del plan). */
  onCambio: () => void;
}) {
  const { showToast } = useToast();
  const [filas, setFilas] = useState<AsignacionPlan[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [fecha, setFecha] = useState("");
  const [km, setKm] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aQuitar, setAQuitar] = useState<AsignacionPlan | null>(null);
  /** Fila con el modal de acciones abierto. */
  const [accionesAbiertasId, setAccionesAbiertasId] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    apiJson<AsignacionPlan[]>(mantUrl(`planes/${encodeURIComponent(planId)}/vehiculos`, tenantId), () => getToken())
      .then((data) => {
        if (cancelado) return;
        setFilas(data);
        setError(null);
      })
      .catch((e) => {
        if (cancelado) return;
        setFilas([]);
        setError(friendlyError(e, "mantenimiento"));
      });
    return () => {
      cancelado = true;
    };
  }, [planId, tenantId, getToken, reloadKey]);

  function empezarEdicion(a: AsignacionPlan) {
    setEditando(a.id);
    setFecha(a.baseFecha ? a.baseFecha.slice(0, 10) : "");
    setKm(a.baseKm != null ? String(a.baseKm) : "");
    setEditError(null);
  }

  async function patch(a: AsignacionPlan, body: Record<string, unknown>, ok: string) {
    setOcupado(a.id);
    try {
      await apiJson(mantUrl(`vehiculos-planes/${encodeURIComponent(a.id)}`, tenantId), () => getToken(), {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      showToast(ok, "success");
      setEditando(null);
      onCambio();
    } catch (e) {
      if (editando === a.id) setEditError(friendlyError(e, "mantenimiento"));
      else showToast(friendlyError(e, "mantenimiento"), "error");
    } finally {
      setOcupado(null);
    }
  }

  function guardarBase(a: AsignacionPlan) {
    if (fecha && fecha > hoyArgentinaIso()) {
      setEditError("La fecha del último service no puede ser futura.");
      return;
    }
    void patch(a, { baseFecha: fecha || null, baseKm: km ? Number(km) : null }, `Último service de ${a.vehiculo.patente} actualizado`);
  }

  async function quitar() {
    if (!aQuitar) return;
    setOcupado(aQuitar.id);
    try {
      await apiJson(mantUrl(`vehiculos-planes/${encodeURIComponent(aQuitar.id)}`, tenantId), () => getToken(), {
        method: "DELETE",
      });
      showToast(`${aQuitar.vehiculo.patente} quitado del plan`, "success");
      setAQuitar(null);
      onCambio();
    } catch (e) {
      // 409 si alguna OT cumplió la asignación: el mensaje pide desactivarla.
      showToast(friendlyError(e, "mantenimiento"), "error");
    } finally {
      setOcupado(null);
    }
  }

  if (filas === null) return <p className="text-sm text-vialto-steel">Cargando…</p>;
  if (error) return <p className="text-xs font-medium text-red-600">{error}</p>;
  if (filas.length === 0) return <p className="text-sm text-vialto-steel">Todavía no hay vehículos asignados a este plan.</p>;

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/10 text-left text-[10px] uppercase tracking-[0.12em] text-vialto-steel">
              <th className="py-1.5 pr-3 font-semibold">Vehículo</th>
              <th className="py-1.5 pr-3 font-semibold">Último service (al asignar)</th>
              <th className="py-1.5 pr-3 font-semibold">Estado</th>
              {!soloLectura && <th className="py-1.5 text-right font-semibold">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {filas.map((a) => {
              const acciones: AccionOpcion[] = [
                { id: "editar", label: "Editar último service", icon: Pencil, disabled: !!ocupado, onClick: () => empezarEdicion(a) },
                {
                  id: "activo",
                  label: a.activo ? "Desactivar" : "Reactivar",
                  icon: a.activo ? PowerOff : Power,
                  disabled: !!ocupado,
                  onClick: () =>
                    void patch(
                      a,
                      { activo: !a.activo },
                      a.activo ? `${a.vehiculo.patente}: asignación desactivada` : `${a.vehiculo.patente}: asignación reactivada`,
                    ),
                },
                { id: "eliminar", label: "Quitar del plan", icon: Trash2, danger: true, disabled: !!ocupado, onClick: () => setAQuitar(a) },
              ];
              const clickeable = !soloLectura && editando !== a.id;
              return (
              <tr
                key={a.id}
                className={`border-b border-black/5 align-middle${clickeable ? " cursor-pointer hover:bg-vialto-mist/40" : ""}`}
                onClick={clickeable ? () => clickFilaAcciones(acciones, () => setAccionesAbiertasId(a.id)) : undefined}
              >
                <td className="py-1.5 pr-3">
                  <VehiculoHoverCard vehiculoId={a.vehiculo.id}>{a.vehiculo.patente}</VehiculoHoverCard>
                  <span className="block text-xs text-vialto-steel">{labelTipoVehiculo(a.vehiculo.tipo)}</span>
                </td>
                <td className="py-1.5 pr-3">
                  {editando === a.id ? (
                    <div className="grid gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="w-40">
                          <FechaPicker value={fecha} onChange={setFecha} allowClear aria-label="Fecha del último service" />
                        </div>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={km}
                          onChange={(e) => setKm(e.target.value.replace(/\D/g, ""))}
                          placeholder="Km"
                          aria-label="Km del último service"
                          className="h-10 w-28 border border-black/15 bg-white px-3 text-sm"
                        />
                      </div>
                      {editError && <span className="text-xs font-medium text-red-600">{editError}</span>}
                    </div>
                  ) : (
                    [a.baseFecha ? fmtFecha(a.baseFecha) : null, a.baseKm != null ? fmtKm(a.baseKm) : null]
                      .filter(Boolean)
                      .join(" · ") || <span className="text-vialto-steel">Sin cargar</span>
                  )}
                </td>
                <td className="py-1.5 pr-3">{a.activo ? "Activa" : <InactivoBadge />}</td>
                {!soloLectura && (
                  <td className="py-1 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-wrap items-center justify-end gap-3">
                      {ocupado === a.id && <Spinner className="h-3.5 w-3.5" />}
                      {editando === a.id ? (
                        <>
                          <button type="button" disabled={!!ocupado} onClick={() => guardarBase(a)} className={LINK}>
                            Guardar
                          </button>
                          <button type="button" disabled={!!ocupado} onClick={() => setEditando(null)} className={LINK}>
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <AccionesFila
                          options={acciones}
                          destacadas={["editar", "activo"]}
                          subtitle={a.vehiculo.patente}
                          open={accionesAbiertasId === a.id}
                          onOpenChange={(o) => setAccionesAbiertasId(o ? a.id : null)}
                        />
                      )}
                    </div>
                  </td>
                )}
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ConfirmDialog
        open={!!aQuitar}
        title="Quitar vehículo del plan"
        message={`¿Quitar ${aQuitar?.vehiculo.patente ?? ""} de este plan? Deja de aparecer en Vencimientos. Si alguna orden de trabajo ya cumplió este plan para el vehículo, hay que desactivarlo en lugar de quitarlo.`}
        confirmLabel="Quitar"
        tone="danger"
        busy={!!ocupado}
        onConfirm={() => void quitar()}
        onCancel={() => setAQuitar(null)}
      />
    </>
  );
}
