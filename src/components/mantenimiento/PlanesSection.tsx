import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Eye, Power, PowerOff, Trash2, Truck } from "lucide-react";
import { ListadoDatos } from "@/components/listado/ListadoDatos";
import { LimpiarFiltrosPortal } from "@/components/listado/LimpiarFiltrosButton";
import { ViajesListadoHeaderFiltro } from "@/components/viajes/ViajesListadoHeaderFiltro";
import type { AccionOpcion } from "@/components/ui/AccionesOpcionesSheet";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { InactivoBadge } from "@/components/mantenimiento/MantenimientoBadges";
import { PlanModal, type PlanModalEstado } from "@/components/mantenimiento/PlanModal";
import { AsignarVehiculosModal } from "@/components/mantenimiento/AsignarVehiculosModal";
import { PlantillasPlanModal } from "@/components/mantenimiento/PlantillasPlanModal";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { listadoTablaHeadRowClass, listadoTablaAccionesTdClass, listadoTablaThClass } from "@/lib/listadoTabla";
import { mantUrl } from "@/lib/mantenimientoApi";
import { CATEGORIA_PLAN_LABELS, fmtAviso, fmtIntervalo } from "@/lib/mantenimientoLabels";
import { useToast } from "@/lib/toast";
import { labelTipoVehiculo } from "@/lib/vehiculoTipos";
import type { PlanMantenimiento, PlantillaPlan } from "@/types/mantenimiento";

const FILTRO_INPUT = "h-9 w-full border border-black/15 bg-white px-2 text-sm";
const BTN_SECUNDARIO =
  "inline-flex h-10 items-center gap-2 border border-black/20 bg-white px-4 text-sm uppercase tracking-wider hover:bg-vialto-mist disabled:opacity-50";
const BTN_PRIMARIO =
  "inline-flex h-10 items-center px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite";

/**
 * Pestaña Planes: qué mantenimiento lleva cada vehículo (cada cuántos km/días) y a qué
 * vehículos se aplica. Se trae una vez (`GET mantenimiento/planes`) y se filtra en el cliente.
 */
export function PlanesSection({
  getToken,
  tenantId,
  soloLectura,
  reloadKey,
  onCambio,
  limpiarFiltrosSlot,
  accionesSlot,
}: {
  getToken: () => Promise<string | null>;
  tenantId?: string;
  soloLectura: boolean;
  reloadKey: number;
  /** Cambió un plan o una asignación: el padre recarga los vencimientos. */
  onCambio: () => void;
  /** Lugar junto al título de la página para "Limpiar filtros". */
  limpiarFiltrosSlot?: HTMLElement | null;
  /** Lugar de las acciones del título ("Nuevo plan", "Cargar planes sugeridos"). */
  accionesSlot?: HTMLElement | null;
}) {
  const { showToast } = useToast();
  const [planes, setPlanes] = useState<PlanMantenimiento[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [categoria, setCategoria] = useState("");
  const [estado, setEstado] = useState<"activos" | "inactivos" | "">("activos");

  const [modal, setModal] = useState<PlanModalEstado | null>(null);
  const [modalKey, setModalKey] = useState(0);
  const [asignando, setAsignando] = useState<PlanMantenimiento | null>(null);
  const [aBorrar, setABorrar] = useState<PlanMantenimiento | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [plantillasAbierto, setPlantillasAbierto] = useState(false);
  const [faltanPlantillas, setFaltanPlantillas] = useState(false);

  useEffect(() => {
    let cancelado = false;
    apiJson<PlanMantenimiento[]>(mantUrl("planes", tenantId), () => getToken())
      .then((data) => {
        if (cancelado) return;
        setPlanes(data);
        setError(null);
      })
      .catch((e) => {
        if (cancelado) return;
        setPlanes([]);
        setError(friendlyError(e, "mantenimiento"));
      });
    return () => {
      cancelado = true;
    };
  }, [getToken, tenantId, reloadKey]);

  // "Cargar planes sugeridos" solo si falta alguno (la ruta es de admin).
  useEffect(() => {
    if (soloLectura) return;
    let cancelado = false;
    apiJson<PlantillaPlan[]>(mantUrl("planes/plantillas", tenantId), () => getToken())
      .then((data) => !cancelado && setFaltanPlantillas(data.some((t) => !t.yaCargada)))
      .catch(() => !cancelado && setFaltanPlantillas(true));
    return () => {
      cancelado = true;
    };
  }, [getToken, tenantId, reloadKey, soloLectura]);

  const hayFiltros = !!categoria || estado !== "activos";
  const filtrados = useMemo(() => {
    if (!planes) return null;
    return planes.filter(
      (p) =>
        (!categoria || p.categoria === categoria) &&
        (estado === "" || (estado === "activos" ? p.activo : !p.activo)),
    );
  }, [planes, categoria, estado]);

  async function cambiarActivo(p: PlanMantenimiento) {
    try {
      await apiJson(mantUrl(`planes/${encodeURIComponent(p.id)}`, tenantId), () => getToken(), {
        method: "PATCH",
        body: JSON.stringify({ activo: !p.activo }),
      });
      showToast(p.activo ? `"${p.nombre}" desactivado` : `"${p.nombre}" activado`, "success");
      onCambio();
    } catch (e) {
      showToast(friendlyError(e, "mantenimiento"), "error");
    }
  }

  async function borrar() {
    if (!aBorrar) return;
    setOcupado(true);
    try {
      // Sin historial, el backend lo desvincula de sus vehículos y lo borra; con historial, 409.
      const r = await apiJson<{ desvinculados: number }>(
        mantUrl(`planes/${encodeURIComponent(aBorrar.id)}`, tenantId),
        () => getToken(),
        { method: "DELETE" },
      );
      const n = r.desvinculados;
      showToast(
        n > 0 ? `"${aBorrar.nombre}" eliminado y quitado de ${n} ${n === 1 ? "vehículo" : "vehículos"}` : `"${aBorrar.nombre}" eliminado`,
        "success",
      );
      setABorrar(null);
      onCambio();
    } catch (e) {
      // 409 si tiene historial: el mensaje del backend pide desactivarlo.
      showToast(friendlyError(e, "mantenimiento"), "error");
    } finally {
      setOcupado(false);
    }
  }

  function abrir(estadoModal: PlanModalEstado) {
    setModalKey((k) => k + 1);
    setModal(estadoModal);
  }

  const btnNuevoPlan = (
    <button type="button" onClick={() => abrir({ modo: "crear" })} className={BTN_PRIMARIO}>
      Nuevo plan
    </button>
  );

  return (
    <div>
      {/* Con planes, junto al título va solo "Nuevo plan"; los sugeridos se ofrecen en el estado vacío. */}
      {accionesSlot && !soloLectura && planes?.length !== 0 && createPortal(btnNuevoPlan, accionesSlot)}
      <LimpiarFiltrosPortal
        slot={limpiarFiltrosSlot}
        visible={hayFiltros}
        onClick={() => {
          setCategoria("");
          setEstado("activos");
        }}
        soloDesktop
      />
      {error && (
        <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      )}

      {planes && planes.length === 0 && !error ? (
        <div className="border border-dashed border-black/15 bg-white px-6 py-10 text-center">
          <p className="text-sm text-vialto-charcoal">Todavía no hay planes de mantenimiento.</p>
          {!soloLectura && (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {faltanPlantillas && (
                <button type="button" onClick={() => setPlantillasAbierto(true)} className={BTN_SECUNDARIO}>
                  Cargar planes sugeridos
                </button>
              )}
              {btnNuevoPlan}
            </div>
          )}
        </div>
      ) : (
        <ListadoDatos<PlanMantenimiento>
          tableColSpan={7}
          tableHead={
            <tr className={listadoTablaHeadRowClass}>
              <th scope="col" className={`${listadoTablaThClass} align-top`}>
                <ViajesListadoHeaderFiltro
                  title="Plan"
                  filterActive={!!categoria}
                  filterSignature={categoria}
                  onClear={() => setCategoria("")}
                >
                  <select
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    aria-label="Filtrar por categoría"
                    className={`${FILTRO_INPUT} ${categoria ? "text-vialto-fire" : ""}`}
                  >
                    <option value="">Mecánicos y documentales</option>
                    <option value="documental">Documentales</option>
                    <option value="mecanico">Mecánicos</option>
                  </select>
                </ViajesListadoHeaderFiltro>
              </th>
              <th scope="col" className={listadoTablaThClass}>Tipo de vehículo</th>
              <th scope="col" className={listadoTablaThClass}>Intervalo</th>
              <th scope="col" className={listadoTablaThClass}>Aviso</th>
              <th scope="col" className={`${listadoTablaThClass} text-right`}>Vehículos</th>
              <th scope="col" className={`${listadoTablaThClass} align-top`}>
                <ViajesListadoHeaderFiltro
                  title="Estado"
                  filterActive={estado !== "activos"}
                  filterSignature={estado}
                  onClear={() => setEstado("activos")}
                >
                  <select
                    value={estado}
                    onChange={(e) => setEstado(e.target.value as typeof estado)}
                    aria-label="Filtrar por estado"
                    className={`${FILTRO_INPUT} ${estado !== "activos" ? "text-vialto-fire" : ""}`}
                  >
                    <option value="activos">Activos</option>
                    <option value="inactivos">Inactivos</option>
                    <option value="">Todos</option>
                  </select>
                </ViajesListadoHeaderFiltro>
              </th>
              <th scope="col" className={`${listadoTablaThClass} text-right`}>Acciones</th>
            </tr>
          }
          columns={[
            {
              id: "plan",
              header: "Plan",
              primary: true,
              cell: (p) => (
                <span>
                  {p.nombre}
                  <span className="block text-xs text-vialto-steel">{CATEGORIA_PLAN_LABELS[p.categoria] ?? p.categoria}</span>
                </span>
              ),
            },
            { id: "tipo", header: "Tipo de vehículo", cell: (p) => (p.tipoVehiculo ? labelTipoVehiculo(p.tipoVehiculo) : "Cualquiera") },
            { id: "intervalo", header: "Intervalo", cell: (p) => fmtIntervalo(p) },
            { id: "aviso", header: "Aviso", cell: (p) => fmtAviso(p) },
            { id: "vehiculos", header: "Vehículos", tdClassName: "text-right tabular-nums", cell: (p) => p._count.vehiculos },
            { id: "estado", header: "Estado", cell: (p) => (p.activo ? "Activo" : <InactivoBadge />) },
          ]}
          rows={error ? [] : filtrados}
          rowKey={(p) => p.id}
          emptyMessage={
            error ? "No se pudieron cargar los planes." : "No hay planes que coincidan con los filtros aplicados."
          }
          loadingMessage="Cargando…"
          actionsTdClassName={`${listadoTablaAccionesTdClass} text-right`}
          rowActionsDestacadas={soloLectura ? ["ver"] : ["ver", "asignar"]}
          rowActionsSubtitle={(p) => p.nombre}
          rowActions={(p) => {
            const opciones: AccionOpcion[] = [
              { id: "ver", label: "Ver plan", icon: Eye, onClick: () => abrir({ modo: "ver", planId: p.id }) },
            ];
            if (!soloLectura) {
              if (p.activo) opciones.push({ id: "asignar", label: "Asignar vehículos", icon: Truck, onClick: () => setAsignando(p) });
              opciones.push(
                p.activo
                  ? { id: "activo", label: "Desactivar", icon: PowerOff, onClick: () => void cambiarActivo(p) }
                  : { id: "activo", label: "Activar", icon: Power, onClick: () => void cambiarActivo(p) },
                { id: "eliminar", label: "Eliminar", icon: Trash2, danger: true, onClick: () => setABorrar(p) },
              );
            }
            return opciones;
          }}
        />
      )}

      {modal && (
        <PlanModal
          key={modalKey}
          estado={modal}
          soloLectura={soloLectura}
          getToken={getToken}
          tenantId={tenantId}
          onClose={() => setModal(null)}
          onGuardado={(plan, creado) => {
            onCambio();
            // Recién creado: seguir directo con la asignación (es lo que falta para que aparezca en Vencimientos).
            if (creado && plan.activo) setAsignando(plan);
          }}
          onAsignar={(plan) => setAsignando(plan)}
        />
      )}
      {asignando && (
        <AsignarVehiculosModal
          plan={asignando}
          getToken={getToken}
          tenantId={tenantId}
          onClose={() => setAsignando(null)}
          onAsignado={() => {
            onCambio();
            setModalKey((k) => k + 1); // si el plan está abierto, se recarga su lista de vehículos
          }}
        />
      )}
      {plantillasAbierto && (
        <PlantillasPlanModal
          getToken={getToken}
          tenantId={tenantId}
          onClose={() => setPlantillasAbierto(false)}
          onCargados={onCambio}
        />
      )}
      <ConfirmDialog
        open={!!aBorrar}
        title="Eliminar plan"
        message={`¿Eliminar "${aBorrar?.nombre ?? ""}"?`}
        confirmLabel="Eliminar"
        tone="danger"
        busy={ocupado}
        onConfirm={() => void borrar()}
        onCancel={() => setABorrar(null)}
      />
    </div>
  );
}
