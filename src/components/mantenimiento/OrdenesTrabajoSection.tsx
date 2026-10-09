import { useEffect, useState } from "react";
import { Ban, Eye, Trash2 } from "lucide-react";
import { ListadoDatos } from "@/components/listado/ListadoDatos";
import { ListadoPagination } from "@/components/listado/ListadoPagination";
import { SearchableEntitySelect } from "@/components/forms/SearchableEntitySelect";
import { filtrarVehiculos } from "@/components/forms/maestroSearchFilters";
import { ViajesListadoHeaderFiltro } from "@/components/viajes/ViajesListadoHeaderFiltro";
import { AccionesFila } from "@/components/ui/AccionesFila";
import type { AccionOpcion } from "@/components/ui/AccionesOpcionesSheet";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EstadoOrdenBadge } from "@/components/mantenimiento/MantenimientoBadges";
import { useMaestroData } from "@/hooks/useMaestroData";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { listadoTablaHeadRowClass, listadoTablaTdClass, listadoTablaThClass } from "@/lib/listadoTabla";
import { mantUrl } from "@/lib/mantenimientoApi";
import { fmtFecha, fmtKm, fmtMoneda, fmtTipoOrden, TIPO_ORDEN_LABELS } from "@/lib/mantenimientoLabels";
import { useToast } from "@/lib/toast";
import type { PaginatedMeta, Vehiculo } from "@/types/api";
import type { OrdenTrabajo, Taller, TipoOrden } from "@/types/mantenimiento";

const FILTRO_INPUT = "h-9 w-full border border-black/15 bg-white px-2 text-sm";

/** Pestaña Órdenes de trabajo: listado paginado en el server (`GET mantenimiento/ordenes`). */
export function OrdenesTrabajoSection({
  getToken,
  tenantId,
  soloLectura,
  reloadKey,
  onVer,
  onCambio,
}: {
  getToken: () => Promise<string | null>;
  tenantId?: string;
  soloLectura: boolean;
  reloadKey: number;
  onVer: (ordenId: string) => void;
  /** Se anuló o borró una orden: el padre recarga también los vencimientos. */
  onCambio: () => void;
}) {
  const maestro = useMaestroData();
  const { showToast } = useToast();

  const [ordenes, setOrdenes] = useState<OrdenTrabajo[] | null>(null);
  const [meta, setMeta] = useState<PaginatedMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [vehiculoId, setVehiculoId] = useState("");
  const [tipo, setTipo] = useState("");
  const [tallerId, setTallerId] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [talleres, setTalleres] = useState<Taller[]>([]);

  const [aAnular, setAAnular] = useState<OrdenTrabajo | null>(null);
  const [aBorrar, setABorrar] = useState<OrdenTrabajo | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    apiJson<Taller[]>(mantUrl("talleres", tenantId), () => getToken())
      .then(setTalleres)
      .catch(() => setTalleres([]));
  }, [getToken, tenantId, reloadKey]);

  useEffect(() => {
    let cancelado = false;
    setOrdenes(null);
    apiJson<{ items: OrdenTrabajo[]; meta: PaginatedMeta }>(
      mantUrl("ordenes", tenantId, { page, pageSize, vehiculoId, tipo, tallerId, desde, hasta }),
      () => getToken(),
    )
      .then((data) => {
        if (cancelado) return;
        setOrdenes(data.items);
        setMeta(data.meta);
        setError(null);
      })
      .catch((e) => {
        if (cancelado) return;
        setOrdenes([]);
        setError(friendlyError(e, "mantenimiento"));
      });
    return () => {
      cancelado = true;
    };
  }, [getToken, tenantId, reloadKey, page, pageSize, vehiculoId, tipo, tallerId, desde, hasta]);

  /** Cambiar un filtro vuelve a la página 1. */
  function filtro<T>(set: (v: T) => void) {
    return (v: T) => {
      set(v);
      setPage(1);
    };
  }

  const hayFiltros = !!vehiculoId || !!tipo || !!tallerId || !!desde || !!hasta;

  async function confirmar(accion: "anular" | "borrar") {
    const orden = accion === "anular" ? aAnular : aBorrar;
    if (!orden) return;
    setOcupado(true);
    try {
      await apiJson(
        mantUrl(accion === "anular" ? `ordenes/${encodeURIComponent(orden.id)}/anular` : `ordenes/${encodeURIComponent(orden.id)}`, tenantId),
        () => getToken(),
        { method: accion === "anular" ? "POST" : "DELETE" },
      );
      showToast(accion === "anular" ? `Orden N° ${orden.numero} anulada` : `Orden N° ${orden.numero} eliminada`, "success");
      setAAnular(null);
      setABorrar(null);
      onCambio();
    } catch (e) {
      // Ej. 409 al borrar una OT que cumple planes: el mensaje del backend pide anularla.
      showToast(friendlyError(e, "mantenimiento"), "error");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div>
      {error && (
        <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      )}

      <ListadoDatos<OrdenTrabajo>
        tableColSpan={9}
        tableHead={
          <tr className={listadoTablaHeadRowClass}>
            <th scope="col" className={listadoTablaThClass}>N°</th>
            <th scope="col" className={`${listadoTablaThClass} align-top`}>
              <ViajesListadoHeaderFiltro
                title="Fecha"
                filterActive={!!desde || !!hasta}
                filterSignature={`${desde}|${hasta}`}
                onClear={() => {
                  setDesde("");
                  setHasta("");
                  setPage(1);
                }}
              >
                <div className="flex flex-col gap-2">
                  <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-vialto-steel">
                    Desde
                    <input type="date" value={desde} onChange={(e) => filtro(setDesde)(e.target.value)} className={FILTRO_INPUT} />
                  </label>
                  <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-vialto-steel">
                    Hasta
                    <input type="date" value={hasta} onChange={(e) => filtro(setHasta)(e.target.value)} className={FILTRO_INPUT} />
                  </label>
                </div>
              </ViajesListadoHeaderFiltro>
            </th>
            <th scope="col" className={`${listadoTablaThClass} align-top`}>
              <ViajesListadoHeaderFiltro
                title="Vehículo"
                filterActive={!!vehiculoId}
                filterSignature={vehiculoId}
                onClear={() => filtro(setVehiculoId)("")}
              >
                <SearchableEntitySelect<Vehiculo>
                  id="ordenes-filtro-unidad"
                  items={maestro.vehiculos}
                  value={vehiculoId}
                  onChange={filtro(setVehiculoId)}
                  filterItems={filtrarVehiculos}
                  getPrimaryLabel={(v) => v.patente}
                  getSecondaryLabel={(v) => [v.marca, v.modelo].filter(Boolean).join(" · ") || null}
                  placeholderCerrado="Todos"
                  placeholderBuscar="Buscar patente o marca…"
                  searchAriaLabel="Filtrar vehículos"
                  allowEmptyValue
                  emptyListChoiceLabel="Todos"
                  aria-label="Filtrar por vehículo"
                  inputClassName={`${FILTRO_INPUT} ${vehiculoId ? "text-vialto-fire" : "text-vialto-charcoal"}`}
                />
              </ViajesListadoHeaderFiltro>
            </th>
            <th scope="col" className={`${listadoTablaThClass} align-top`}>
              <ViajesListadoHeaderFiltro title="Tipo" filterActive={!!tipo} filterSignature={tipo} onClear={() => filtro(setTipo)("")}>
                <select
                  value={tipo}
                  onChange={(e) => filtro(setTipo)(e.target.value)}
                  aria-label="Filtrar por tipo"
                  className={`${FILTRO_INPUT} ${tipo ? "text-vialto-fire" : ""}`}
                >
                  <option value="">Todos</option>
                  {(Object.keys(TIPO_ORDEN_LABELS) as TipoOrden[]).map((t) => (
                    <option key={t} value={t}>
                      {TIPO_ORDEN_LABELS[t]}
                    </option>
                  ))}
                </select>
              </ViajesListadoHeaderFiltro>
            </th>
            <th scope="col" className={`${listadoTablaThClass} align-top`}>
              <ViajesListadoHeaderFiltro
                title="Taller"
                filterActive={!!tallerId}
                filterSignature={tallerId}
                onClear={() => filtro(setTallerId)("")}
              >
                <select
                  value={tallerId}
                  onChange={(e) => filtro(setTallerId)(e.target.value)}
                  aria-label="Filtrar por taller"
                  className={`${FILTRO_INPUT} ${tallerId ? "text-vialto-fire" : ""}`}
                >
                  <option value="">Todos</option>
                  {talleres.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nombre}
                    </option>
                  ))}
                </select>
              </ViajesListadoHeaderFiltro>
            </th>
            <th scope="col" className={listadoTablaThClass}>Km</th>
            <th scope="col" className={`${listadoTablaThClass} text-right`}>Costo</th>
            <th scope="col" className={listadoTablaThClass}>Estado</th>
            <th scope="col" className={`${listadoTablaThClass} text-right`}>Acciones</th>
          </tr>
        }
        columns={[
          { id: "numero", header: "N°", cell: (o) => <span className="tabular-nums">{o.numero}</span> },
          { id: "fecha", header: "Fecha", cell: (o) => fmtFecha(o.fecha) },
          { id: "unidad", header: "Vehículo", primary: true, cell: (o) => o.vehiculo.patente },
          { id: "tipo", header: "Tipo", cell: (o) => fmtTipoOrden(o.tipo) },
          { id: "taller", header: "Taller", cell: (o) => o.taller?.nombre ?? "—" },
          { id: "km", header: "Km", cell: (o) => fmtKm(o.km) },
          {
            id: "costo",
            header: "Costo",
            tdClassName: "text-right tabular-nums",
            cell: (o) => fmtMoneda(o.costoTotal),
          },
          { id: "estado", header: "Estado", cell: (o) => <EstadoOrdenBadge estado={o.estado} /> },
        ]}
        rows={error ? [] : ordenes}
        rowKey={(o) => o.id}
        onRowClick={(o) => onVer(o.id)}
        emptyMessage={
          error
            ? "No se pudieron cargar las órdenes de trabajo."
            : hayFiltros
              ? "No hay órdenes que coincidan con los filtros aplicados."
              : "Todavía no hay órdenes de trabajo registradas."
        }
        loadingMessage="Cargando…"
        actionsTdClassName={listadoTablaTdClass}
        renderActions={(o) => {
          const opciones: AccionOpcion[] = [{ id: "ver", label: "Ver", icon: Eye, onClick: () => onVer(o.id) }];
          if (!soloLectura && o.estado !== "anulada") {
            opciones.push({ id: "anular", label: "Anular", icon: Ban, onClick: () => setAAnular(o) });
          }
          if (!soloLectura) {
            opciones.push({ id: "eliminar", label: "Eliminar", icon: Trash2, danger: true, onClick: () => setABorrar(o) });
          }
          return <AccionesFila options={opciones} destacadas={["ver"]} />;
        }}
      />

      {meta && (
        <ListadoPagination
          meta={meta}
          pageSize={pageSize}
          loading={ordenes === null}
          totalLabel="órdenes"
          onPageChange={setPage}
          onPageSizeChange={(n) => {
            setPageSize(n);
            setPage(1);
          }}
        />
      )}

      <ConfirmDialog
        open={!!aAnular}
        title="Anular orden de trabajo"
        message={`¿Anular la orden N° ${aAnular?.numero ?? ""}? Deja de contar para el km y para los vencimientos de los planes que cumplía. Queda en el historial como anulada.`}
        confirmLabel="Anular"
        tone="danger"
        busy={ocupado}
        onConfirm={() => void confirmar("anular")}
        onCancel={() => setAAnular(null)}
      />
      <ConfirmDialog
        open={!!aBorrar}
        title="Eliminar orden de trabajo"
        message={`¿Eliminar la orden N° ${aBorrar?.numero ?? ""}? Esta acción no se puede deshacer. Si la orden cumple planes de mantenimiento, hay que anularla en lugar de eliminarla.`}
        confirmLabel="Eliminar"
        tone="danger"
        busy={ocupado}
        onConfirm={() => void confirmar("borrar")}
        onCancel={() => setABorrar(null)}
      />
    </div>
  );
}
