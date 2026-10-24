import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowUp, FileText, Gauge, History, Wrench } from "lucide-react";
import type { AccionOpcion } from "@/components/ui/AccionesOpcionesSheet";
import { ListadoDatos } from "@/components/listado/ListadoDatos";
import { LimpiarFiltrosPortal } from "@/components/listado/LimpiarFiltrosButton";
import { FiltrosRapidos, type FiltroRapidoOpcion } from "@/components/listado/FiltrosRapidos";
import { SearchableEntitySelect } from "@/components/forms/SearchableEntitySelect";
import { filtrarVehiculos } from "@/components/forms/maestroSearchFilters";
import { ViajesListadoHeaderFiltro } from "@/components/viajes/ViajesListadoHeaderFiltro";
import { AccionesFila } from "@/components/ui/AccionesFila";
import { VehiculoHoverCard } from "@/components/vehiculos/VehiculoHoverCard";
import { EstadoVencimientoBadge } from "@/components/mantenimiento/MantenimientoBadges";
import { useMaestroData } from "@/hooks/useMaestroData";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { listadoTablaHeadRowClass, listadoTablaAccionesTdClass, listadoTablaThClass } from "@/lib/listadoTabla";
import { mantUrl } from "@/lib/mantenimientoApi";
import {
  CATEGORIA_PLAN_LABELS,
  ESTADO_VENCIMIENTO,
  ESTADOS_VENCIMIENTO_ORDEN,
  fmtFaltan,
  fmtFecha,
  fmtKm,
  fmtReferencia,
} from "@/lib/mantenimientoLabels";
import type { Vehiculo } from "@/types/api";
import type { EstadoVencimiento, FilaVencimiento, PrecargaOrden } from "@/types/mantenimiento";

/** Filtros rápidos junto al título (como en Viajes): solo lo que requiere atención. */
const ESTADOS_FILTRO_RAPIDO = ["vencido", "proximo"] as const;
type EstadoFiltroRapido = (typeof ESTADOS_FILTRO_RAPIDO)[number];

/**
 * Pestaña Vencimientos (default de Mantenimiento): el semáforo que calcula el backend
 * (`GET mantenimiento/vencimientos`), una fila por plan asignado a una unidad. Se trae una vez y
 * se filtra en el cliente, así los contadores no cambian al filtrar.
 */
export function VencimientosSection({
  getToken,
  tenantId,
  soloLectura,
  reloadKey,
  onRegistrarService,
  limpiarFiltrosSlot,
  onIrAPlanes,
  onHistorial,
  onEditarKm,
}: {
  getToken: () => Promise<string | null>;
  tenantId?: string;
  soloLectura: boolean;
  reloadKey: number;
  onRegistrarService: (precarga: PrecargaOrden) => void;
  /** Sin asignaciones: link a la pestaña Planes. */
  onIrAPlanes?: () => void;
  onHistorial: (vehiculoId: string) => void;
  onEditarKm: (vehiculoId: string) => void;
  /** Lugar junto al título de la página para "Limpiar filtros". */
  limpiarFiltrosSlot?: HTMLElement | null;
}) {
  const maestro = useMaestroData();
  const [filas, setFilas] = useState<FilaVencimiento[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [estado, setEstado] = useState<EstadoVencimiento | "">("");
  const [vehiculoId, setVehiculoId] = useState("");
  const [categoria, setCategoria] = useState("");
  const [ordenFecha, setOrdenFecha] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    let cancelado = false;
    setFilas(null);
    apiJson<FilaVencimiento[]>(mantUrl("vencimientos", tenantId), () => getToken())
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
  }, [getToken, tenantId, reloadKey]);

  const contadores = useMemo(() => {
    const c: Record<EstadoVencimiento, number> = { vencido: 0, proximo: 0, sin_datos: 0, ok: 0 };
    for (const f of filas ?? []) c[f.estado]++;
    return c;
  }, [filas]);

  const opcionesRapidas: FiltroRapidoOpcion<EstadoFiltroRapido>[] = ESTADOS_FILTRO_RAPIDO.map((e) => ({
    id: e,
    label: ESTADO_VENCIMIENTO[e].contador,
    count: filas ? contadores[e] : undefined,
  }));

  const hayFiltros = !!estado || !!vehiculoId || !!categoria;
  const filtradas = useMemo(() => {
    if (!filas) return null;
    const lista = filas.filter(
      (f) =>
        (!estado || f.estado === estado) &&
        (!vehiculoId || f.vehiculo.id === vehiculoId) &&
        (!categoria || f.plan.categoria === categoria),
    );
    // Por fecha estimada (la más cercana primero, o al revés); las que no tienen fecha, siempre al final.
    // `sort` es estable: a igual fecha queda el orden del backend (vencido → próximo → sin datos → ok).
    const signo = ordenFecha === "asc" ? 1 : -1;
    return [...lista].sort((a, b) => {
      if (!a.fechaEstimada || !b.fechaEstimada) return a.fechaEstimada ? -1 : b.fechaEstimada ? 1 : 0;
      return a.fechaEstimada.localeCompare(b.fechaEstimada) * signo;
    });
  }, [filas, estado, vehiculoId, categoria, ordenFecha]);

  const vehiculosConPlanes = useMemo(() => {
    const ids = new Set((filas ?? []).map((f) => f.vehiculo.id));
    return maestro.vehiculos.filter((v) => ids.has(v.id));
  }, [filas, maestro.vehiculos]);

  function registrarService(f: FilaVencimiento) {
    onRegistrarService({
      vehiculoId: f.vehiculo.id,
      vehiculoPlanIds: [f.vehiculoPlanId],
      tareas: f.plan.tareas,
      km: f.odometro?.km ?? null,
    });
  }

  return (
    <div>
      {limpiarFiltrosSlot &&
        createPortal(
          <FiltrosRapidos<EstadoFiltroRapido>
            opciones={opcionesRapidas}
            value={estado === "vencido" || estado === "proximo" ? estado : ""}
            onChange={(v) => setEstado(v)}
            ariaLabel="Filtrar vencimientos por estado"
          />,
          limpiarFiltrosSlot,
        )}
      <LimpiarFiltrosPortal
        slot={limpiarFiltrosSlot}
        visible={hayFiltros}
        onClick={() => {
          setEstado("");
          setVehiculoId("");
          setCategoria("");
        }}
        soloDesktop
      />
      {error && (
        <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      )}
      {filas?.length === 0 && !error && onIrAPlanes && (
        <p className="mb-4 text-sm text-vialto-steel">
          Los vencimientos salen de los planes asignados a cada vehículo.{" "}
          <button type="button" onClick={onIrAPlanes} className="font-medium text-vialto-fire hover:underline">
            Ir a Planes
          </button>
        </p>
      )}

      <ListadoDatos<FilaVencimiento>
        tableColSpan={8}
        tableHead={
          <tr className={listadoTablaHeadRowClass}>
            <th scope="col" className={`${listadoTablaThClass} align-top`}>
              <ViajesListadoHeaderFiltro
                title="Estado"
                filterActive={!!estado}
                filterSignature={estado}
                onClear={() => setEstado("")}
              >
                <select
                  value={estado}
                  onChange={(e) => setEstado(e.target.value as EstadoVencimiento | "")}
                  aria-label="Filtrar por estado"
                  className={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${estado ? "text-vialto-fire" : ""}`}
                >
                  <option value="">Todos</option>
                  {ESTADOS_VENCIMIENTO_ORDEN.map((e) => (
                    <option key={e} value={e}>
                      {ESTADO_VENCIMIENTO[e].contador}
                    </option>
                  ))}
                </select>
              </ViajesListadoHeaderFiltro>
            </th>
            <th scope="col" className={`${listadoTablaThClass} align-top`}>
              <ViajesListadoHeaderFiltro
                title="Vehículo"
                filterActive={!!vehiculoId}
                filterSignature={vehiculoId}
                onClear={() => setVehiculoId("")}
              >
                <SearchableEntitySelect<Vehiculo>
                  id="vencimientos-filtro-unidad"
                  items={vehiculosConPlanes}
                  value={vehiculoId}
                  onChange={setVehiculoId}
                  filterItems={filtrarVehiculos}
                  getPrimaryLabel={(v) => v.patente}
                  getSecondaryLabel={(v) => [v.marca, v.modelo].filter(Boolean).join(" · ") || null}
                  placeholderCerrado="Todos"
                  placeholderBuscar="Buscar patente o marca…"
                  searchAriaLabel="Filtrar vehículos"
                  allowEmptyValue
                  emptyListChoiceLabel="Todos"
                  aria-label="Filtrar por vehículo"
                  inputClassName={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${vehiculoId ? "text-vialto-fire" : "text-vialto-charcoal"}`}
                />
              </ViajesListadoHeaderFiltro>
            </th>
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
                  className={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${categoria ? "text-vialto-fire" : ""}`}
                >
                  <option value="">Mecánicos y documentales</option>
                  <option value="documental">Documentales</option>
                  <option value="mecanico">Mecánicos</option>
                </select>
              </ViajesListadoHeaderFiltro>
            </th>
            <th scope="col" className={listadoTablaThClass}>Faltan</th>
            <th scope="col" className={listadoTablaThClass} aria-sort={ordenFecha === "asc" ? "ascending" : "descending"}>
              <button
                type="button"
                onClick={() => setOrdenFecha((o) => (o === "asc" ? "desc" : "asc"))}
                title={ordenFecha === "asc" ? "Más cercana primero (tocá para invertir)" : "Más lejana primero (tocá para invertir)"}
                className="inline-flex items-center gap-1 uppercase hover:underline"
              >
                Fecha estimada
                {ordenFecha === "asc" ? (
                  <ArrowUp className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                ) : (
                  <ArrowDown className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                )}
              </button>
            </th>
            <th scope="col" className={listadoTablaThClass}>Km actual</th>
            <th scope="col" className={listadoTablaThClass}>Último service</th>
            <th scope="col" className={`${listadoTablaThClass} text-right`}>Acciones</th>
          </tr>
        }
        columns={[
          { id: "estado", header: "Estado", cell: (f) => <EstadoVencimientoBadge estado={f.estado} /> },
          { id: "unidad", header: "Vehículo", primary: true, cell: (f) => <VehiculoHoverCard vehiculoId={f.vehiculo.id}>{f.vehiculo.patente}</VehiculoHoverCard> },
          {
            id: "plan",
            header: "Plan",
            cell: (f) => {
              const Icono = f.plan.categoria === "documental" ? FileText : Wrench;
              const categoria = CATEGORIA_PLAN_LABELS[f.plan.categoria] ?? f.plan.categoria;
              return (
                <span className="inline-flex items-center gap-1.5">
                  <Icono className="h-3.5 w-3.5 shrink-0 text-vialto-steel/60" strokeWidth={1.75} aria-label={categoria} />
                  <span title={categoria}>{f.plan.nombre}</span>
                </span>
              );
            },
          },
          {
            id: "faltan",
            header: "Faltan",
            cell: (f) => (
              <span className={f.estado === "vencido" ? "font-medium text-red-700" : f.estado === "proximo" ? "font-medium text-amber-800" : ""}>
                {fmtFaltan(f)}
              </span>
            ),
          },
          { id: "fechaEstimada", header: "Fecha estimada", cell: (f) => fmtFecha(f.fechaEstimada) },
          {
            id: "km",
            header: "Km actual",
            cell: (f) => fmtKm(f.odometro?.km),
          },
          { id: "referencia", header: "Último service", cell: (f) => <span className="text-sm">{fmtReferencia(f)}</span> },
        ]}
        rows={error ? [] : filtradas}
        rowKey={(f) => f.vehiculoPlanId}
        emptyMessage={
          error
            ? "No se pudieron cargar los vencimientos."
            : hayFiltros
              ? "No hay vencimientos que coincidan con los filtros aplicados."
              : "Todavía no hay planes asignados a los vehículos."
        }
        loadingMessage="Calculando vencimientos…"
        actionsTdClassName={listadoTablaAccionesTdClass}
        renderActions={(f) => {
          const opciones: AccionOpcion[] = [];
          if (!soloLectura) {
            opciones.push({ id: "registrar", label: "Registrar service", icon: Wrench, onClick: () => registrarService(f) });
          }
          opciones.push({ id: "historial", label: "Historial del vehículo", icon: History, onClick: () => onHistorial(f.vehiculo.id) });
          if (!soloLectura) {
            // Mismo nombre e ícono que en Combustible → Asignación de vehículos.
            opciones.push({ id: "editar-km", label: "Editar km", icon: Gauge, onClick: () => onEditarKm(f.vehiculo.id) });
          }
          return <AccionesFila options={opciones} destacadas={soloLectura ? ["historial"] : ["registrar", "historial"]} />;
        }}
      />
    </div>
  );
}
